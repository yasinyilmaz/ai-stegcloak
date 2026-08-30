import {
  DATA_ALPHABET,
  TAG_WIDTH,
  decodeTag,
  encodeSymbol,
  stripWatermarkCharacters,
} from "./alphabet.js";

const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });
const alphabetSet = new Set(DATA_ALPHABET);

export function getWordSegments(text) {
  return [...segmenter.segment(String(text ?? ""))];
}

export function getVisibleWords(text) {
  return getWordSegments(stripWatermarkCharacters(text))
    .filter((segment) => segment.isWordLike)
    .map((segment) => segment.segment);
}

export function countVisibleWords(text) {
  return getVisibleWords(text).length;
}

export function embedSymbols(text, symbols) {
  const cleanText = stripWatermarkCharacters(text);
  const segments = getWordSegments(cleanText);
  const wordCount = segments.filter((segment) => segment.isWordLike).length;

  if (!Array.isArray(symbols) || symbols.length !== wordCount) {
    throw new Error(`Expected ${wordCount} symbols, received ${symbols?.length ?? 0}.`);
  }

  let symbolIndex = 0;
  const watermarkedText = segments
    .map((segment) => {
      if (!segment.isWordLike) return segment.segment;
      const tag = encodeSymbol(symbols[symbolIndex]);
      symbolIndex += 1;
      return `${segment.segment}${tag}`;
    })
    .join("");

  return { watermarkedText, wordCount };
}

/**
 * Extracts both the six-bit tag values and the visible words carrying them.
 * Intl.Segmenter keeps these format characters inside the word segment in
 * current Node and browser engines, but the suffix parser keeps the rule
 * explicit and rejects malformed runs.
 */
export function extractTaggedWords(text) {
  const taggedWords = [];

  for (const segment of getWordSegments(text)) {
    if (!segment.isWordLike) continue;

    const characters = [...segment.segment];
    const suffix = characters.slice(-TAG_WIDTH);
    if (suffix.length !== TAG_WIDTH || !suffix.every((character) => alphabetSet.has(character))) {
      continue;
    }

    const tag = suffix.join("");
    const symbol = decodeTag(tag);
    if (symbol === null) continue;

    const visibleWord = characters.slice(0, -TAG_WIDTH).join("");
    if (!visibleWord) continue;

    taggedWords.push({ word: visibleWord, symbol });
  }

  return taggedWords;
}

