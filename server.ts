import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const questieSiteRoot = path.resolve(__dirname, 'questie-site');
const distRoot = path.resolve(__dirname, 'dist');
const root = fs.existsSync(questieSiteRoot) ? questieSiteRoot : distRoot;

const mime: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  wasm: 'application/wasm',
  riv: 'application/octet-stream',
  css: 'text/css; charset=utf-8',
  json: 'application/json',
  png: 'image/png',
};

const port = Number(process.env.PORT ?? 3000);
const baseHeaders: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-cache',
};

const server = http.createServer((req, res) => {
  const method = req.method ?? 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    res.writeHead(405, {...baseHeaders, Allow: 'GET, HEAD'});
    res.end('Method not allowed');
    return;
  }

  let pathname: string;
  let search = '';
  try {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    pathname = decodeURIComponent(url.pathname);
    search = url.search;
  } catch {
    res.writeHead(400, baseHeaders);
    res.end('Bad request');
    return;
  }

  if (pathname === '/healthz') {
    res.writeHead(200, baseHeaders);
    res.end(method === 'HEAD' ? undefined : 'ok');
    return;
  }

  if (
    pathname.includes('\\') ||
    pathname.includes('\0') ||
    pathname.split('/').some((p) => p === '..' || p.startsWith('.'))
  ) {
    res.writeHead(404, baseHeaders);
    res.end('Not found');
    return;
  }

  if (pathname.endsWith('/')) {
    pathname += 'index.html';
  } else if (!pathname.split('/').at(-1)?.includes('.')) {
    res.writeHead(308, {...baseHeaders, Location: `${pathname}/${search}`});
    res.end();
    return;
  }

  const filePath = path.resolve(root, `.${pathname}`);
  if (!filePath.startsWith(root + path.sep)) {
    res.writeHead(404, baseHeaders);
    res.end('Not found');
    return;
  }

  let stat: fs.Stats;
  try {
    stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      res.writeHead(404, baseHeaders);
      res.end('Not found');
      return;
    }
  } catch {
    res.writeHead(404, baseHeaders);
    res.end('Not found');
    return;
  }

  const ext = filePath.split('.').at(-1) ?? '';
  res.writeHead(200, {
    ...baseHeaders,
    'Content-Type': mime[ext] ?? 'application/octet-stream',
    'Content-Length': String(stat.size),
  });

  if (method === 'HEAD') {
    res.end();
    return;
  }

  fs.createReadStream(filePath).pipe(res);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Questie preview listening on port ${port}`);
});
