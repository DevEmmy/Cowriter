import assert from "node:assert/strict";
import { db, schema } from "../src/lib/db";
import { countWords } from "../src/lib/words";
import { saveChapter, ownedChapter, snapshot } from "../src/lib/manuscript";
import { eq } from "drizzle-orm";

(async () => {
  assert.equal(countWords("<p>Hello <strong>wor</strong>ld</p><p>Two  words</p>"), 4, "inline tags must not split words");
  assert.equal(countWords("<p>One</p><p>two</p>"), 2, "paragraphs must not fuse");
  assert.equal(countWords("<p>a&nbsp;b</p>"), 2);

  const [a] = await db().insert(schema.users).values({ email: `a${Date.now()}@t.io`, passwordHash: "x" }).returning();
  const [b] = await db().insert(schema.users).values({ email: `b${Date.now()}@t.io`, passwordHash: "x" }).returning();
  const [p] = await db().insert(schema.projects).values({ userId: a.id, title: "T" }).returning();
  const [c] = await db().insert(schema.chapters).values({ projectId: p.id, userId: a.id }).returning();

  const r1 = await saveChapter(a.id, c.id, { content: "<p>one two three</p>", revision: 1 });
  assert.ok(r1 && r1.ok && r1.wordCount === 3 && r1.revision === 2);
  const stale = await saveChapter(a.id, c.id, { content: "<p>stale tab text</p>", revision: 1 });
  assert.ok(stale && !stale.ok && stale.conflict, "stale revision must be rejected");
  assert.equal((await ownedChapter(a.id, c.id))!.content, "<p>one two three</p>", "stale save must not overwrite");
  assert.equal(await ownedChapter(b.id, c.id), null, "other users cannot read the chapter");
  assert.equal(await saveChapter(b.id, c.id, { content: "hack", revision: 2 }), null, "other users cannot write the chapter");

  const r2 = await saveChapter(a.id, c.id, { content: "<p>one two three four five</p>", revision: 2 });
  assert.ok(r2 && r2.ok);
  const versions = await db().select().from(schema.chapterVersions).where(eq(schema.chapterVersions.chapterId, c.id));
  assert.equal(versions.length, 1, "auto version only once per 5 minutes");
  await snapshot(a.id, { ...(await ownedChapter(a.id, c.id))! }, "manual");
  const stats = await db().select().from(schema.writingStats).where(eq(schema.writingStats.userId, a.id));
  assert.equal(stats[0].words, 5, "stats count only added words (3 then +2)");
  await saveChapter(a.id, c.id, { content: "<p>short</p>", revision: 3 });
  const stats2 = await db().select().from(schema.writingStats).where(eq(schema.writingStats.userId, a.id));
  assert.equal(stats2[0].words, 5, "deleting words must not reduce or inflate stats");
  await db().delete(schema.users).where(eq(schema.users.id, a.id));
  await db().delete(schema.users).where(eq(schema.users.id, b.id));
  console.log("manuscript tests passed");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
