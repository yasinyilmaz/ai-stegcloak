const sourceText = document.querySelector("#source-text");
const provider = document.querySelector("#provider");
const sourceCount = document.querySelector("#source-count");
const mintButton = document.querySelector("#mint-button");
const mintOutput = document.querySelector("#mint-output");
const watermarkedText = document.querySelector("#watermarked-text");
const mintStats = document.querySelector("#mint-stats");
const copyButton = document.querySelector("#copy-button");
const detectText = document.querySelector("#detect-text");
const detectCount = document.querySelector("#detect-count");
const detectButton = document.querySelector("#detect-button");
const detectResult = document.querySelector("#detect-result");
const revealLayerButton = document.querySelector("#reveal-layer");
const forensicLayer = document.querySelector("#forensic-layer");

const sample = `Yapay zeka sistemleri tarafından üretilen metinlerin kaynağını anlamak giderek daha önemli hale geliyor. Bu deneysel yaklaşım, her kelimenin sonuna yalnızca üç görünmez karakter yerleştirerek doğrulanabilir ve dağıtık bir provenance sinyali oluşturuyor. Metnin bir bölümü silinse, yeni cümleler eklense veya yalnızca tek bir paragraf kopyalansa bile yeterli sembol hayatta kaldığında kaynak doğrulaması yapılabiliyor.`;

sourceText.value = sample;

function visibleWordCount(value) {
  return [...new Intl.Segmenter("tr", { granularity: "word" }).segment(value)]
    .filter((segment) => segment.isWordLike).length;
}

function invisibleCharacterCount(value) {
  return [...value].filter((character) => ["\u2061", "\u2062", "\u2063", "\u2064"].includes(character)).length;
}

function updateCounts() {
  sourceCount.textContent = `${visibleWordCount(sourceText.value)} kelime`;
  detectCount.textContent = `${invisibleCharacterCount(detectText.value)} görünmez karakter`;
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "İstek tamamlanamadı.");
  return payload;
}

function setBusy(button, busy, idleLabel) {
  button.disabled = busy;
  const symbol = button === mintButton ? "✦" : "⌁";
  button.innerHTML = busy ? "İşleniyor…" : `<span>${symbol}</span> ${idleLabel}`;
}

mintButton.addEventListener("click", async () => {
  setBusy(mintButton, true, "Filigran oluştur");
  try {
    const result = await postJson("/api/v1/watermarks/mint", {
      providerId: provider.value,
      text: sourceText.value,
    });
    watermarkedText.value = result.watermarkedText;
    detectText.value = result.watermarkedText;
    mintStats.innerHTML = `
      <span>${result.wordCount} işaretli kelime</span>
      <span>${result.invisibleCharacters} ZWC toplam</span>
      <span>${result.providerId}</span>
    `;
    mintOutput.classList.remove("is-hidden");
    updateCounts();
  } catch (error) {
    window.alert(error.message);
  } finally {
    setBusy(mintButton, false, "Filigran oluştur");
  }
});

copyButton.addEventListener("click", async () => {
  await navigator.clipboard.writeText(watermarkedText.value);
  copyButton.textContent = "Kopyalandı";
  setTimeout(() => { copyButton.textContent = "Kopyala"; }, 1400);
});

const resultCopy = {
  verified_ai_provenance: ["verified", "✓", "AI provenance doğrulandı"],
  suspicious_transplant: ["warning", "!", "Geçerli filigran, uyumsuz içerik"],
  possible: ["warning", "?", "Olası filigran; daha fazla metin gerekli"],
  insufficient_evidence: ["warning", "…", "Kanıt yetersiz"],
  malformed_watermark: ["failed", "×", "Bozuk görünmez karakter dizisi"],
  unknown_watermark: ["failed", "×", "Registry içinde eşleşme yok"],
  not_detected: ["neutral", "⌁", "Filigran bulunamadı"],
};

function renderResult(result) {
  const [className, icon, title] = resultCopy[result.status] || resultCopy.not_detected;
  const details = result.aiProvenance
    ? `${result.providerId} sağlayıcısına ait doğrulanmış, dağıtık filigran bulundu.`
    : result.status === "suspicious_transplant"
      ? "Sembol dizisi geçerli ancak görünür içerik kayıtlı kaynakla yeterince uyuşmuyor."
      : "Bu sonuç metnin insan tarafından yazıldığını kanıtlamaz.";

  const evidence = result.evidence
    ? `<div class="evidence-list">
        <span>${result.extractedSymbols} sembol</span>
        <span>${result.evidence.longestRun} en uzun dizi</span>
        <span>%${Math.round(result.evidence.windowCoverage * 100)} pencere eşleşmesi</span>
        <span>%${Math.round(result.contentMatch * 100)} içerik uyumu</span>
      </div>`
    : `<div class="evidence-list"><span>${result.invisibleCharacters || 0} ZWC</span></div>`;

  detectResult.className = `result-card ${className}`;
  detectResult.innerHTML = `
    <span class="result-icon">${icon}</span>
    <div><strong>${title}</strong><p>${details}</p>${evidence}</div>
  `;
}

detectButton.addEventListener("click", async () => {
  setBusy(detectButton, true, "Taramayı başlat");
  try {
    const result = await postJson("/api/v1/watermarks/detect", { text: detectText.value });
    renderResult(result);
  } catch (error) {
    renderResult({ status: "not_detected", invisibleCharacters: 0 });
    window.alert(error.message);
  } finally {
    setBusy(detectButton, false, "Taramayı başlat");
  }
});

revealLayerButton.addEventListener("click", () => {
  const revealed = revealLayerButton.getAttribute("aria-expanded") === "true";
  revealLayerButton.setAttribute("aria-expanded", String(!revealed));
  forensicLayer.setAttribute("aria-hidden", String(revealed));
  forensicLayer.classList.toggle("is-concealed", revealed);
  revealLayerButton.textContent = revealed ? "Görünmez katmanı göster" : "Görünmez katmanı gizle";
});

sourceText.addEventListener("input", updateCounts);
detectText.addEventListener("input", updateCounts);
updateCounts();
