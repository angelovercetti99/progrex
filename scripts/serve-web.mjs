// Serves the exported web app (apps/mobile/dist) at http://localhost:8100.
// SQLite on the web needs these two headers, so a plain static server won't do.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = new URL('../apps/mobile/dist/', import.meta.url).pathname;
const port = 8100;
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.wasm': 'application/wasm',
  '.css': 'text/css',
  '.ttf': 'font/ttf',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = join(root, path);
  let data;
  try {
    data = await readFile(file);
  } catch {
    // Unknown paths (e.g. /progress) are app routes: serve the app.
    file = join(root, 'index.html');
    data = await readFile(file);
  }
  res.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream');
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.end(data);
}).listen(port, () => console.log(`Progrex: http://localhost:${port}`));
