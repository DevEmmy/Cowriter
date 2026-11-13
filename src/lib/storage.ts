import { getStore } from "@netlify/blobs";

// Private per-user file storage (Netlify Blobs). Keys are namespaced by user id,
// and files are only ever read through authenticated API routes.
const store = () => getStore({ name: "cowriter-files", consistency: "strong" });

export const fileKey = (userId: string, projectId: string, name: string) =>
  `${userId}/${projectId}/${name.replace(/[^\w.\-]+/g, "_")}`;

export async function putFile(key: string, data: ArrayBuffer | Uint8Array, contentType: string) {
  const buf = data instanceof Uint8Array ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) : data;
  await store().set(key, buf as ArrayBuffer, { metadata: { contentType } });
}

export async function getFile(key: string): Promise<ArrayBuffer | null> {
  return (await store().get(key, { type: "arrayBuffer" })) ?? null;
}

export async function deleteFile(key: string) {
  await store().delete(key);
}
