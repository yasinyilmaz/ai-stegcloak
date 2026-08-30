import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../src/server.js";

const masterKey = "abcdef0123456789abcdef0123456789";
const text = `Dağıtık görünmez filigran araştırması yapay zeka tarafından üretilen metinlerin kaynağını doğrulamayı hedefliyor. Her kelimeye eklenen üç kısa karakter metin parçalansa veya kullanıcı tarafından düzenlense bile yeterli sinyalin hayatta kalmasına yardımcı oluyor.`;

async function withServer(run) {
  const { server } = createApp({ masterKey });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();

  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    server.close();
    await once(server, "close");
  }
}

test("mint and detect endpoints complete an end-to-end flow", async () => {
  await withServer(async (baseUrl) => {
    const mintResponse = await fetch(`${baseUrl}/api/v1/watermarks/mint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, providerId: "api-test-provider" }),
    });
    assert.equal(mintResponse.status, 201);
    const mint = await mintResponse.json();

    const detectResponse = await fetch(`${baseUrl}/api/v1/watermarks/detect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: mint.watermarkedText }),
    });
    assert.equal(detectResponse.status, 200);
    const detection = await detectResponse.json();

    assert.equal(detection.status, "verified_ai_provenance");
    assert.equal(detection.providerId, "api-test-provider");
  });
});

test("the health endpoint reports registry size", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);
    const health = await response.json();
    assert.deepEqual(health, { ok: true, records: 0, developmentKey: false });
  });
});

test("invalid mint requests return a client error", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/watermarks/mint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "çok kısa" }),
    });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.match(body.error, /At least 8 words/);
  });
});

