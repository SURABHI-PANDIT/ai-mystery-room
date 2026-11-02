import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../storage/media');
const allowedExtensions = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/webp', '.webp'],
  ['video/mp4', '.mp4'],
]);

function storageRoot(root = process.env.MEDIA_STORAGE_DIR || defaultRoot) {
  return resolve(root);
}

function safePath(storageRef, root) {
  if (typeof storageRef !== 'string' || storageRef !== storageRef.split(/[\\/]/).pop()) {
    throw new Error('Invalid media storage reference.');
  }
  const target = resolve(root, storageRef);
  if (!target.startsWith(`${root}${sep}`)) throw new Error('Invalid media storage path.');
  return target;
}

export async function storeMedia(buffer, mimeType, root = process.env.MEDIA_STORAGE_DIR || defaultRoot) {
  const extension = allowedExtensions.get(mimeType);
  if (!extension) throw new Error('Unsupported generated media type.');
  const mediaId = randomUUID();
  const storageRef = `${mediaId}${extension}`;
  const base = storageRoot(root);
  await mkdir(base, { recursive: true });
  await writeFile(safePath(storageRef, base), buffer, { flag: 'wx' });
  return { mediaId, storageRef, mimeType };
}

export async function readMedia(storageRef, root = process.env.MEDIA_STORAGE_DIR || defaultRoot) {
  const base = storageRoot(root);
  return readFile(safePath(storageRef, base));
}

export async function deleteMedia(storageRef, root = process.env.MEDIA_STORAGE_DIR || defaultRoot) {
  const base = storageRoot(root);
  await rm(safePath(storageRef, base), { force: true });
}

export function mediaExtension(storageRef) {
  return extname(storageRef);
}
