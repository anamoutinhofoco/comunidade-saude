// Servidor estático local para pré-visualizar public/ (equivalente ao Vercel com cleanUrls).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const pasta = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const porta = Number(process.env.PORT ?? 3100);
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain' };

async function resolver(caminho) {
  const base = join(pasta, decodeURIComponent(caminho).replace(/\.\.+/g, ''));
  for (const c of [base, base + '.html', join(base, 'index.html')]) {
    try { if ((await stat(c)).isFile()) return c; } catch { /* tenta o próximo */ }
  }
  return null;
}

createServer(async (req, res) => {
  const arquivo = await resolver(new URL(req.url, 'http://x').pathname);
  if (!arquivo) { res.writeHead(404); res.end('Não encontrado'); return; }
  res.writeHead(200, { 'Content-Type': TIPOS[extname(arquivo)] ?? 'application/octet-stream' });
  res.end(await readFile(arquivo));
}).listen(porta, () => console.log(`Painel em http://localhost:${porta}`));
