/**
 * Four invisible mathematical operator characters. Using four symbols gives us
 * an exact two bits per character and avoids ZWJ/ZWNJ shaping behavior.
 */
export const DATA_ALPHABET = Object.freeze([
  "\u2061", // FUNCTION APPLICATION
  "\u2062", // INVISIBLE TIMES
  "\u2063", // INVISIBLE SEPARATOR
  "\u2064", // INVISIBLE PLUS
]);

export const TAG_WIDTH = 3;
export const SYMBOL_BITS = TAG_WIDTH * 2;
export const SYMBOL_CARDINALITY = 2 ** SYMBOL_BITS;

const alphabetPattern = DATA_ALPHABET
  .map((character) => `\\u${character.codePointAt(0).toString(16).padStart(4, "0")}`)
  .join("");

const watermarkCharacterPattern = new RegExp(`[${alphabetPattern}]`, "gu");
const watermarkTagPattern = new RegExp(`[${alphabetPattern}]{${TAG_WIDTH}}`, "gu");

export function encodeSymbol(value) {
  if (!Number.isInteger(value) || value < 0 || value >= SYMBOL_CARDINALITY) {
    throw new RangeError(`Symbol must be an integer between 0 and ${SYMBOL_CARDINALITY - 1}.`);
  }

  let remaining = value;
  const encoded = new Array(TAG_WIDTH);

  for (let index = TAG_WIDTH - 1; index >= 0; index -= 1) {
    encoded[index] = DATA_ALPHABET[remaining & 0b11];
    remaining >>= 2;
  }

  return encoded.join("");
}

export function decodeTag(tag) {
  if (typeof tag !== "string" || [...tag].length !== TAG_WIDTH) {
    return null;
  }

  let value = 0;
  for (const character of tag) {
    const digit = DATA_ALPHABET.indexOf(character);
    if (digit === -1) return null;
    value = (value << 2) | digit;
  }

  return value;
}

export function extractSymbols(text) {
  if (typeof text !== "string") return [];

  return [...text.matchAll(watermarkTagPattern)]
    .map((match) => decodeTag(match[0]))
    .filter((value) => value !== null);
}

export function stripWatermarkCharacters(text) {
  return String(text ?? "").replace(watermarkCharacterPattern, "");
}

export function countWatermarkCharacters(text) {
  return [...String(text ?? "").matchAll(watermarkCharacterPattern)].length;
}

export function hasPartialWatermarkRun(text) {
  const characterCount = countWatermarkCharacters(text);
  return characterCount > 0 && characterCount % TAG_WIDTH !== 0;
}

