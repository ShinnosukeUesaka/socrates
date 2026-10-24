// Serves the playground for trying the extension: npm start
//   /       a page with fields to type into
//   /news/  The Daily Certainty, a fictional news site full of bad reasoning
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const port = Number(process.env.PORT) || 4173;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../playground");
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8" };

export function startPlayground(listenPort = port) {
  const server = createServer(async (req, res) => {
    let pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    if (pathname.endsWith("/")) pathname += "index.html";
    const file = path.resolve(root, `.${pathname}`);
    const type = TYPES[path.extname(file)];
    if (!file.startsWith(root + path.sep) || !type) {
      res.writeHead(404).end("Not found");
      return;
    }
    try {
      const body = await readFile(file);
      res.writeHead(200, { "content-type": type });
      res.end(body);
    } catch {
      res.writeHead(404).end("Not found");
    }
  });
  return new Promise((resolve) => server.listen(listenPort, "127.0.0.1", () => resolve(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await startPlayground();
  console.log(`Socrates playground: http://127.0.0.1:${port}  ·  fake news site: http://127.0.0.1:${port}/news/`);
}
