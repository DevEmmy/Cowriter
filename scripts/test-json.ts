import { extractJson } from "../src/lib/ai/json";
import assert from "node:assert";
assert.deepStrictEqual(extractJson('Sure!\n```json\n{"a":1,"b":{"c":"}"}}\n```\nbye'), { a: 1, b: { c: "}" } });
assert.deepStrictEqual(extractJson('{"a":"he said \\"hi\\" {"}'), { a: 'he said "hi" {' });
assert.throws(() => extractJson("no json here"));
assert.throws(() => extractJson('{"a":1'));
console.log("json ok");
