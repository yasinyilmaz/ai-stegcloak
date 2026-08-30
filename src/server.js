import { createServer as createHttpServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { MemoryWatermarkStore } from "./store/memory-store.js";
import { WatermarkService } from "./watermark/service.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.resolve(currentDirectory, "../public");
const MAX_BODY_BYTES = 1_000_000;

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
]);

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error("Request body is too large.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) return {};

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Request body must be valid JSON.");
    error.statusCode = 400;
    throw error;
  }
}

async function serveStatic(requestPath, response) {
  const requested = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = path.resolve(publicDirectory, `.${requested}`);

  if (!filePath.startsWith(`${publicDirectory}${path.sep}`)) {
    sendJson(response, 404, { error: "Not found." });
    return;
  }

  try {
    const content = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes.get(path.extname(filePath)) || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    response.end(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      sendJson(response, 404, { error: "Not found." });
      return;
    }
    throw error;
  }
}

export function createApp({ masterKey, store = new MemoryWatermarkStore() } = {}) {
  const service = new WatermarkService({ store, masterKey });
  const corsOrigin = process.env.CORS_ORIGIN || "*";

  const server = createHttpServer(async (request, response) => {
    response.setHeader("Access-Control-Allow-Origin", corsOrigin);
    response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

    try {
      if (request.method === "GET" && url.pathname === "/api/health") {
        sendJson(response, 200, {
          ok: true,
          records: store.size,
          developmentKey: service.usingDevelopmentKey,
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/v1/watermarks/mint") {
        const body = await readJsonBody(request);
        const result = service.mint({ text: body.text, providerId: body.providerId });
        sendJson(response, 201, result);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/v1/watermarks/detect") {
        const body = await readJsonBody(request);
        const result = service.detect(body.text);
        sendJson(response, 200, result);
        return;
      }

      if (request.method === "GET") {
        await serveStatic(url.pathname, response);
        return;
      }

      sendJson(response, 404, { error: "Not found." });
    } catch (error) {
      const statusCode = error.statusCode || 400;
      sendJson(response, statusCode, { error: error.message || "Unexpected error." });
    }
  });

  return { server, service, store };
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  const port = Number.parseInt(process.env.PORT || "8787", 10);
  const { server, service } = createApp();

  server.listen(port, () => {
    console.log(`AI StegCloak Lab: http://localhost:${port}`);
    if (service.usingDevelopmentKey) {
      console.warn("Using the development watermark key. Set WATERMARK_MASTER_KEY before production use.");
    }
  });
}

