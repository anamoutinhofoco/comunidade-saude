// Valida dados/hls.json e gera public/dados/hls.json, que o painel consome.
// Roda no build do Vercel (npm run build).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const dados = JSON.parse(readFileSync(join(raiz, 'dados', 'hls.json'), 'utf8'));

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const erros = [];
const exigir = (cond, msg) => { if (!cond) erros.push(msg); };

for (const [lista, campo] of [['decisoes', 'id'], ['frentes', 'id']]) {
  const ids = new Set();
  for (const item of dados[lista] ?? []) {
    exigir(!ids.has(item[campo]), `${lista}: id duplicado ${item[campo]}`);
    ids.add(item[campo]);
  }
}
for (const [lista, campo] of [['publicacoes', 'id'], ['disparos', 'codigo'], ['checkpoints', 'id']]) {
  const ids = new Set();
  for (const item of dados[lista] ?? []) {
    exigir(!ids.has(item[campo]), `${lista}: ${campo} duplicado ${item[campo]}`);
    ids.add(item[campo]);
    exigir(ISO.test(item.data), `${lista} ${item[campo]}: data inválida (${item.data}); use AAAA-MM-DD`);
    exigir(!item.hora || /^\d{2}:\d{2}$/.test(item.hora), `${lista} ${item[campo]}: hora inválida (${item.hora})`);
  }
}
for (const x of dados.disparos ?? []) exigir(x.medicos && x.outras, `${x.codigo}: faltam as versões M e O`);
for (const d of dados.decisoes) exigir(!d.prazo || ISO.test(d.prazo), `${d.id}: prazo inválido (${d.prazo})`);

if (erros.length) throw new Error('Dados inválidos:\n - ' + erros.join('\n - '));

dados.geradoEm = new Date().toISOString();

mkdirSync(join(raiz, 'public', 'dados'), { recursive: true });
writeFileSync(join(raiz, 'public', 'dados', 'hls.json'), JSON.stringify(dados, null, 2) + '\n');
console.log(`✓ dados/hls.json → public/dados/hls.json`);
console.log(`  ${dados.frentes.length} frentes · ${dados.decisoes.length} decisões · ${dados.publicacoes.length} publicações · ${dados.disparos.length} disparos · ${dados.checkpoints.length} checkpoints`);
