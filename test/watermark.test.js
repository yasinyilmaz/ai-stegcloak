import test from "node:test";
import assert from "node:assert/strict";
import { MemoryWatermarkStore } from "../src/store/memory-store.js";
import { WatermarkService } from "../src/watermark/service.js";
import { countWatermarkCharacters, encodeSymbol } from "../src/watermark/alphabet.js";
import { embedSymbols, extractTaggedWords } from "../src/watermark/text.js";

const masterKey = "0123456789abcdef0123456789abcdef";
const sourceText = `Yapay zeka sistemleri tarafından üretilen metinlerin kaynağını anlamak giderek daha önemli hale geliyor. Bu deneysel yaklaşım her kelimenin sonuna yalnızca üç görünmez karakter yerleştirerek doğrulanabilir ve dağıtık bir provenance sinyali oluşturuyor. Metnin bir bölümü silinse yeni cümleler eklense veya yalnızca tek bir paragraf kopyalansa bile yeterli sembol hayatta kaldığında kaynak doğrulaması güvenilir biçimde yapılabiliyor. Sistem kullanıcı kimliği saklamadan yalnızca katılımcı bir sağlayıcının çıktı kanalından gelen içeriği işaretlemeyi ve daha sonra doğrulamayı amaçlıyor.`;

function createService(store = new MemoryWatermarkStore()) {
  return new WatermarkService({ store, masterKey });
}

test("each visible word receives exactly three watermark characters", () => {
  const service = createService();
  const result = service.mint({ text: sourceText, providerId: "research-provider" });

  assert.equal(result.invisibleCharacters, result.wordCount * 3);
  assert.equal(countWatermarkCharacters(result.watermarkedText), result.wordCount * 3);
  assert.equal(extractTaggedWords(result.watermarkedText).length, result.wordCount);
});

test("a complete watermarked response is verified", () => {
  const service = createService();
  const mint = service.mint({ text: sourceText, providerId: "research-provider" });
  const detection = service.detect(mint.watermarkedText);

  assert.equal(detection.status, "verified_ai_provenance");
  assert.equal(detection.aiProvenance, true);
  assert.equal(detection.providerId, "research-provider");
  assert.equal(detection.contentMatch, 1);
});

test("a copied fragment preserves enough evidence", () => {
  const service = createService();
  const mint = service.mint({ text: sourceText });
  const fragment = mint.watermarkedText.split(/\s+/u).slice(10, 31).join(" ");
  const detection = service.detect(fragment);

  assert.equal(detection.status, "verified_ai_provenance");
  assert.equal(detection.aiProvenance, true);
  assert.ok(detection.extractedSymbols >= 18);
  assert.ok(detection.contentMatch > 0.8);
});

test("ordinary deletions and unmarked insertions keep the watermark detectable", () => {
  const service = createService();
  const mint = service.mint({ text: sourceText });
  const tokens = mint.watermarkedText.split(/\s+/u).slice(5, 48);
  const customized = tokens
    .filter((_, index) => index % 7 !== 0)
    .flatMap((token, index) => index % 9 === 0 ? [token, "kişisel", "bir", "ekleme"] : [token])
    .join(" ");
  const detection = service.detect(customized);

  assert.equal(detection.status, "verified_ai_provenance");
  assert.equal(detection.aiProvenance, true);
  assert.ok(detection.evidence.matchedWindows >= 3);
});

test("a few tagged words are reported as insufficient evidence", () => {
  const service = createService();
  const mint = service.mint({ text: sourceText });
  const tinyFragment = mint.watermarkedText.split(/\s+/u).slice(0, 5).join(" ");
  const detection = service.detect(tinyFragment);

  assert.equal(detection.status, "insufficient_evidence");
  assert.equal(detection.aiProvenance, false);
});

test("plain text does not produce an AI provenance claim", () => {
  const service = createService();
  service.mint({ text: sourceText });
  const detection = service.detect("Bu metin herhangi bir görünmez filigran taşımayan sıradan ve tamamen açık bir deneme metnidir.");

  assert.equal(detection.status, "not_detected");
  assert.equal(detection.aiProvenance, false);
});

test("a valid tag sequence transplanted to unrelated words is flagged", () => {
  const service = createService();
  const mint = service.mint({ text: sourceText });
  const symbols = extractTaggedWords(mint.watermarkedText).slice(0, 24).map(({ symbol }) => symbol);
  const unrelated = `Bahçedeki kediler sabah güneşinde sessizce dinlenirken uzaktaki vapurlar kıyıya doğru ilerliyordu. Çocuklar renkli uçurtmalarını gökyüzüne bırakıp neşeyle koşuyor aileler hafta sonunun sakin havasından keyif alıyordu.`;
  const unrelatedWords = unrelated.split(/\s+/u);
  const padded = [...unrelatedWords, "bambaşka", "konular", "üzerine", "yazılmış", "yeni", "sözcükler"]
    .slice(0, symbols.length)
    .join(" ");
  const transplanted = embedSymbols(padded, symbols).watermarkedText;
  const detection = service.detect(transplanted);

  assert.equal(detection.status, "suspicious_transplant");
  assert.equal(detection.aiProvenance, false);
  assert.ok(detection.contentMatch < 0.25);
});

test("well-formed but unregistered symbols do not verify", () => {
  const service = createService();
  const words = sourceText.split(/\s+/u).slice(0, 20).join(" ");
  const symbols = Array.from({ length: 20 }, (_, index) => (index * 11 + 7) % 64);
  const unknown = embedSymbols(words, symbols).watermarkedText;
  const detection = service.detect(unknown);

  assert.equal(detection.status, "unknown_watermark");
  assert.equal(detection.aiProvenance, false);
});

test("partial invisible runs are classified as malformed", () => {
  const service = createService();
  const detection = service.detect(`Görünür bir metin${encodeSymbol(3).slice(0, 1)} ile devam ediyor.`);

  assert.equal(detection.status, "malformed_watermark");
  assert.equal(detection.aiProvenance, false);
});

