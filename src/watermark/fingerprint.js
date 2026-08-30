import { createHash } from "node:crypto";
import { getVisibleWords } from "./text.js";

const SHINGLE_SIZE = 3;

function normalizeWord(word) {
  return word.normalize("NFKC").toLowerCase();
}

function hashShingle(shingle) {
  return createHash("sha256").update(shingle).digest("base64url").slice(0, 16);
}

export function fingerprintWords(words, size = SHINGLE_SIZE) {
  const normalized = words.map(normalizeWord).filter(Boolean);

  if (normalized.length === 0) return [];

  if (normalized.length < size) {
    return normalized.map((word) => hashShingle(`word:${word}`));
  }

  const hashes = [];
  for (let index = 0; index <= normalized.length - size; index += 1) {
    hashes.push(hashShingle(normalized.slice(index, index + size).join("\u001f")));
  }
  return hashes;
}

export function fingerprintText(text) {
  return fingerprintWords(getVisibleWords(text));
}

export function containmentScore(candidateHashes, sourceHashes) {
  if (candidateHashes.length === 0 || sourceHashes.length === 0) return 0;

  const sourceSet = new Set(sourceHashes);
  const matches = candidateHashes.filter((hash) => sourceSet.has(hash)).length;
  return matches / candidateHashes.length;
}

