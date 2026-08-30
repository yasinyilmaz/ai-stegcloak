import { createHmac, randomUUID } from "node:crypto";
import { fingerprintText, fingerprintWords, containmentScore } from "./fingerprint.js";
import { classifyEvidence, scoreSequence } from "./evidence.js";
import { embedSymbols, extractTaggedWords, getVisibleWords } from "./text.js";
import { countWatermarkCharacters, hasPartialWatermarkRun } from "./alphabet.js";

const DEFAULT_DEV_KEY = "development-only-key-change-before-production";

export class WatermarkService {
  constructor({ store, masterKey = process.env.WATERMARK_MASTER_KEY || DEFAULT_DEV_KEY } = {}) {
    if (!store) throw new Error("A watermark store is required.");
    if (typeof masterKey !== "string" || Buffer.byteLength(masterKey, "utf8") < 32) {
      throw new Error("The watermark master key must contain at least 32 bytes.");
    }

    this.store = store;
    this.masterKey = masterKey;
    this.usingDevelopmentKey = masterKey === DEFAULT_DEV_KEY;
  }

  #symbolFor(recordId, index) {
    const digest = createHmac("sha256", this.masterKey)
      .update(`aizwc:v1:${recordId}:${index}`)
      .digest();
    return digest[0] & 0b00111111;
  }

  mint({ text, providerId = "demo-provider" }) {
    if (typeof text !== "string" || text.trim().length === 0) {
      throw new Error("Text is required.");
    }

    const words = getVisibleWords(text);
    if (words.length < 8) {
      throw new Error("At least 8 words are required to create a useful watermark.");
    }

    const id = randomUUID();
    const symbols = words.map((_, index) => this.#symbolFor(id, index));
    const { watermarkedText } = embedSymbols(text, symbols);

    const record = {
      id,
      version: 1,
      providerId: String(providerId).slice(0, 64),
      createdAt: new Date().toISOString(),
      wordCount: words.length,
      symbols,
      contentFingerprint: fingerprintText(text),
    };

    this.store.save(record);

    return {
      watermarkId: id,
      providerId: record.providerId,
      createdAt: record.createdAt,
      wordCount: record.wordCount,
      invisibleCharacters: record.wordCount * 3,
      watermarkedText,
    };
  }

  detect(text) {
    if (typeof text !== "string" || text.length === 0) {
      throw new Error("Text is required.");
    }

    const taggedWords = extractTaggedWords(text);
    const candidateSymbols = taggedWords.map(({ symbol }) => symbol);
    const candidateFingerprint = fingerprintWords(taggedWords.map(({ word }) => word));
    const invisibleCharacters = countWatermarkCharacters(text);

    if (candidateSymbols.length === 0) {
      return {
        status: invisibleCharacters > 0 ? "malformed_watermark" : "not_detected",
        aiProvenance: false,
        extractedSymbols: 0,
        invisibleCharacters,
      };
    }

    let bestMatch = null;
    for (const record of this.store.list()) {
      const evidence = scoreSequence(candidateSymbols, record.symbols);
      const classification = classifyEvidence(evidence);
      const contentMatch = containmentScore(candidateFingerprint, record.contentFingerprint);
      const candidate = { record, evidence, classification, contentMatch };

      if (!bestMatch || this.#rank(candidate) > this.#rank(bestMatch)) {
        bestMatch = candidate;
      }
    }

    if (!bestMatch) {
      return {
        status: "unknown_watermark",
        aiProvenance: false,
        extractedSymbols: candidateSymbols.length,
        invisibleCharacters,
      };
    }

    const tagVerified = bestMatch.classification === "verified";
    const contentConsistent = bestMatch.contentMatch >= 0.25;
    const status = tagVerified
      ? contentConsistent
        ? "verified_ai_provenance"
        : "suspicious_transplant"
      : bestMatch.classification;

    return {
      status,
      aiProvenance: tagVerified && contentConsistent,
      providerId: tagVerified ? bestMatch.record.providerId : undefined,
      createdAt: tagVerified ? bestMatch.record.createdAt : undefined,
      watermarkId: tagVerified ? bestMatch.record.id : undefined,
      extractedSymbols: candidateSymbols.length,
      invisibleCharacters,
      malformedTail: hasPartialWatermarkRun(text),
      contentMatch: Number(bestMatch.contentMatch.toFixed(4)),
      evidence: bestMatch.evidence,
    };
  }

  #rank(candidate) {
    const classificationWeight = {
      verified: 3,
      possible: 2,
      insufficient_evidence: 1,
      not_detected: 0,
    }[candidate.classification];

    return (
      classificationWeight * 1_000_000 +
      candidate.evidence.matchedWindows * 10_000 +
      candidate.evidence.longestRun * 100 +
      Math.round(candidate.contentMatch * 100)
    );
  }
}
