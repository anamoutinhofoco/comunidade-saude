// Painel HLS — lê /dados/hls.json (gerado de dados/hls.json no build).

// ---------- Utilidades ----------
const $ = (sel, el = document) => el.querySelector(sel);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const semAcento = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const icone = (id) => `<svg class="icone" aria-hidden="true"><use href="#${id}"/></svg>`;

const DIA_MS = 86400000;
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

const paraData = (iso) => { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d); };
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const diasEntre = (a, b) => Math.round((paraData(b) - paraData(a)) / DIA_MS);
const ddmm = (d) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '—');
const dataLonga = (d) => { const x = paraData(d); return `${SEMANA[x.getDay()]}, ${x.getDate()} de ${MESES[x.getMonth()]}`; };

// "Hoje" pode ser simulado com ?hoje=AAAA-MM-DD.
const HOJE = (() => {
  const p = new URLSearchParams(location.search).get('hoje');
  return /^\d{4}-\d{2}-\d{2}$/.test(p ?? '') ? p : iso(new Date());
})();

// ---------- Status ----------
const REGRAS_STATUS = [
  [/^(enviad|publicad|postad|conclu|feit|realizad|entregue|finaliz|aprovad|resolvid|confirmad)/, 'concluido', 'tag--aprovado'],
  [/^a confirmar/, 'confirmar', 'tag--neutro'],
  [/^pronto/, 'andamento', 'tag--programado'],
  [/(aguardando|em aprova|revis)/, 'andamento', 'tag--revisao'],
  [/(ajuste|bloquead|pausad)/, 'andamento', 'tag--ajuste'],
  [/(andamento|produ|fazendo|program|agendad)/, 'andamento', 'tag--programado'],
  [/cancel/, 'cancelado', 'tag--recusado'],
];

/** Normaliza o status. Itens a fazer ou em andamento com data vencida aparecem como atrasados. */
function status(valor, prazo) {
  const bruto = String(valor ?? '').trim() || 'A fazer';
  const s = semAcento(bruto);
  let grupo = 'afazer';
  let classe = 'tag--neutro';
  for (const [re, g, c] of REGRAS_STATUS) if (re.test(s)) { grupo = g; classe = c; break; }
  if (prazo && prazo < HOJE && (grupo === 'afazer' || grupo === 'andamento')) {
    return { grupo: 'atrasado', classe: 'tag--atrasado', rotulo: 'Atrasado', original: bruto };
  }
  return { grupo, classe, rotulo: bruto, original: bruto };
}
const tagStatus = (st) => `<span class="tag tag--status ${st.classe}"${st.original !== st.rotulo ? ` title="No cadastro: ${esc(st.original)}"` : ''}>${esc(st.rotulo)}</span>`;

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.dataset.visivel = 'true';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.dataset.visivel = 'false'), 2200);
}

// ---------- Carregamento ----------
let D;
try {
  const resp = await fetch('/dados/hls.json', { cache: 'no-cache' });
  if (!resp.ok) throw new Error(resp.status);
  D = await resp.json();
} catch (erro) {
  $('#carregando').innerHTML = `<div class="aviso aviso--erro">${icone('i-alerta')}<div><strong>Não foi possível carregar o painel.</strong>Verifique se o build gerou <code>public/dados/hls.json</code> a partir de <code>dados/hls.json</code>.</div></div>`;
  throw erro;
}

const decisoes = D.decisoes.map((d) => {
  const resolvida = status(d.status).grupo === 'concluido';
  const dias = d.prazo ? diasEntre(HOJE, d.prazo) : null;
  let tag;
  if (resolvida) tag = `<span class="tag tag--status tag--aprovado">${esc(d.status)}</span>`;
  else if (dias !== null && dias < 0) tag = `<span class="tag tag--status tag--atrasado">Vencida há ${-dias} ${-dias === 1 ? 'dia' : 'dias'}</span>`;
  else if (dias !== null && dias <= 7) tag = `<span class="tag tag--status tag--ajuste">${dias === 0 ? 'Vence hoje' : `Vence em ${dias} ${dias === 1 ? 'dia' : 'dias'}`}</span>`;
  else tag = `<span class="tag tag--status tag--neutro">${esc(d.prazo ? d.status : 'Sem prazo definido')}</span>`;
  return { ...d, resolvida, dias, tag };
});
const abertas = decisoes.filter((d) => !d.resolvida);

const tabela = (cab, linhas) => `<div class="tabela-rolagem"><table class="tabela"><thead><tr>${cab.map((c) => `<th scope="col">${c}</th>`).join('')}</tr></thead><tbody>${linhas}</tbody></table></div>`;
function rotularCelulas(raiz) {
  raiz.querySelectorAll('table.tabela').forEach((t) => {
    const cab = [...t.querySelectorAll('thead th')].map((th) => th.textContent);
    t.querySelectorAll('tbody tr').forEach((tr) => [...tr.children].forEach((td, i) => { if (i > 0 && cab[i]) td.dataset.rotulo = cab[i]; }));
  });
}

// ---------- Cabeçalho ----------
function renderCabecalho() {
  $('#hoje-rotulo').textContent = `Hoje: ${dataLonga(HOJE)}`;
  $('#cabecalho-sub').textContent = D.resumo;
  const n = (valor, rotulo, extra = '') => `<div class="cabecalho__numero${extra}"><b>${valor}</b><span>${rotulo}</span></div>`;
  $('#cabecalho-numeros').innerHTML =
    n(D.membros.medicos + D.membros.outras, `membros nas comunidades (${D.membros.medicos} médicos · ${D.membros.outras} outras especialidades)`) +
    n(D.publicacoes.length + D.disparos.length, 'publicações e disparos em outubro') +
    n(abertas.length, 'decisões em aberto');
}

// ---------- Visão geral ----------
function renderFunil() {
  $('#funil').innerHTML = D.funil.map((e) => `<li>${esc(e)}</li>`).join('');
}

function renderFrentes() {
  $('#frentes').innerHTML = D.frentes.map((f) => `
    <article class="cartao frente">
      <div class="frente__topo">
        <span class="frente__nome"><span class="kpi__icone">${icone(f.icone)}</span>${esc(f.nome)}</span>
      </div>
      <div><span class="tag tag--status tag--${esc(f.tom)}">${esc(f.situacao)}</span></div>
      <div class="frente__bloco"><b>Situação</b><span>${esc(f.estado)}</span></div>
      ${f.responsavel ? `<div class="frente__bloco"><b>Responsável</b><span>${esc(f.responsavel)}</span></div>` : ''}
      <div class="frente__bloco"><b>Próximo passo</b><span>${esc(f.proximo)}</span></div>
    </article>`).join('');
}

// ---------- Decisões ----------
function renderDecisoes() {
  const ordenadas = [...decisoes].sort((a, b) => Number(a.resolvida) - Number(b.resolvida) || (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999'));
  $('#lista-decisoes').innerHTML = ordenadas.map((p) => `
    <div class="pendencia">
      <div class="grade" style="gap: 4px">
        <span class="fase">${esc(p.tipo)}</span>
        <span class="pendencia__decisao">${esc(p.decisao)}</span>
        <span class="pendencia__impacto">${esc(p.impacto)}</span>
      </div>
      <div class="pendencia__lado">
        ${p.tag}
        <span class="pendencia__prazo">${p.prazo ? `Prazo ${ddmm(p.prazo)} · ` : ''}${esc(p.responsavel)}</span>
      </div>
    </div>`).join('');
}

// ---------- Operação ----------
function renderOperacao() {
  const { fluxo, regras } = D.operacao;
  const alvo = $('#operacao');
  alvo.innerHTML = `
    <div class="grade" style="gap: var(--e-7)">
      <div class="secao">
        <div class="secao__cabeca"><div><span class="rotulo">fluxo</span><h2 class="f-titulo-2">Insumos → publicação</h2><p class="f-legenda">Sequência de trabalho organizada no Namtab.</p></div></div>
        <div class="fluxo">${fluxo.map((e, i) => `<div class="fluxo__etapa"><span class="fluxo__n">.0${i + 1}</span><b>${esc(e.etapa)}</b><span class="f-legenda">${esc(e.texto)}</span></div>`).join('')}</div>
      </div>
      <div class="cartao grade" style="gap: var(--e-4); align-content: start">
        <h3 class="f-titulo-3">Regras de execução</h3>
        <ul class="lista-seta">${regras.map((r) => `<li>${icone('i-check')}<span><b style="color: var(--texto-forte)">${esc(r.tema)}</b><br><span class="f-legenda">${esc(r.orientacao)}</span></span></li>`).join('')}</ul>
      </div>
    </div>`;
}

// ---------- Abas ----------
const NOMES_ABAS = ['visao-geral', 'agenda', 'mensagens', 'criativos', 'decisoes', 'operacao'];

function trocarAba(nome, { foco = false } = {}) {
  if (!NOMES_ABAS.includes(nome)) nome = 'visao-geral';
  document.querySelectorAll('#abas-painel .aba').forEach((a) => {
    const ativa = a.dataset.aba === nome;
    a.setAttribute('aria-selected', String(ativa));
    a.tabIndex = ativa ? 0 : -1;
    if (ativa && foco) a.focus();
  });
  document.querySelectorAll('.painel-aba').forEach((p) => { p.hidden = p.id !== `painel-${nome}`; });
  if (location.hash !== `#${nome}`) history.replaceState(null, '', `#${nome}`);
}

function atualizarContadores() {
  const conta = {
    decisoes: abertas.length,
  };
  document.querySelectorAll('[data-conta]').forEach((el) => {
    const n = conta[el.dataset.conta];
    el.textContent = n;
    el.hidden = !n;
  });
}

const abasEl = $('#abas-painel');
abasEl.addEventListener('click', (e) => {
  const aba = e.target.closest('.aba');
  if (!aba) return;
  trocarAba(aba.dataset.aba);
  const topo = $('.abas-painel').getBoundingClientRect().top + scrollY - $('.barra').offsetHeight;
  if (scrollY > topo) scrollTo({ top: topo });
});
abasEl.addEventListener('keydown', (e) => {
  if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
  e.preventDefault();
  const atual = NOMES_ABAS.indexOf(document.querySelector('#abas-painel .aba[aria-selected="true"]').dataset.aba);
  const prox = e.key === 'Home' ? 0 : e.key === 'End' ? NOMES_ABAS.length - 1 : (atual + (e.key === 'ArrowRight' ? 1 : -1) + NOMES_ABAS.length) % NOMES_ABAS.length;
  trocarAba(NOMES_ABAS[prox], { foco: true });
});
addEventListener('hashchange', () => trocarAba(location.hash.slice(1)));

// ---------- Agenda (calendário: dia, semana e mês) ----------
const CATS_AG = [
  ['instagram', 'Instagram · Feed'],
  ['whatsapp', 'WhatsApp · Disparos'],
  ['checkpoint', 'Checkpoints de métricas'],
  ['decisao', 'Decisões com prazo'],
];
const ROTULO_CAT = Object.fromEntries(CATS_AG);
const ORDEM_CAT = new Map(CATS_AG.map(([k], i) => [k, i]));
const DIAS_LONGOS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const MESES_LONGOS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const H0 = 7;
const H1 = 21;
const ALT_H = 48;
const DUR_MIN = 45;
const minutos = (hora) => { const [h, m] = hora.split(':').map(Number); return h * 60 + m; };
const somarDias = (d, n) => iso(new Date(paraData(d).getTime() + n * DIA_MS));
const segundaDe = (d) => somarDias(d, -((paraData(d).getDay() + 6) % 7));
const chaveMes = (d) => d.slice(0, 7);
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const campo = (rotulo, valor) => (valor ? `<div><dt>${esc(rotulo)}</dt><dd>${esc(valor)}</dd></div>` : '');
const comMarcadores = (texto) => esc(texto).replace(/\[([^\]]+)\]/g, '<mark class="marcador">[$1]</mark>');
const copias = new Map();

const eventosAgenda = (() => {
  const lista = [];
  for (const p of D.publicacoes) {
    lista.push({ id: `ig:${p.id}`, cat: 'instagram', data: p.data, hora: p.hora, codigo: p.id, titulo: p.titulo, item: p, st: status(p.situacao, p.data) });
  }
  for (const x of D.disparos) {
    lista.push({ id: `wa:${x.codigo}`, cat: 'whatsapp', data: x.data, hora: x.hora, codigo: x.codigo, titulo: x.tema, item: x, st: status(x.status, x.data) });
  }
  for (const c of D.checkpoints) {
    lista.push({ id: `ck:${c.id}`, cat: 'checkpoint', data: c.data, codigo: c.id, titulo: c.titulo, item: c, st: status(c.status ?? 'A fazer', c.data) });
  }
  for (const p of decisoes) {
    if (!p.prazo) continue;
    lista.push({ id: `dc:${p.id}`, cat: 'decisao', data: p.prazo, codigo: p.id, titulo: p.decisao, item: p, st: status(p.resolvida ? 'Confirmado' : 'Pendente', p.prazo) });
  }
  return lista;
})();
const eventoPorId = new Map(eventosAgenda.map((e) => [e.id, e]));

const porDiaAgenda = new Map();
for (const e of eventosAgenda) {
  if (!porDiaAgenda.has(e.data)) porDiaAgenda.set(e.data, []);
  porDiaAgenda.get(e.data).push(e);
}
for (const lista of porDiaAgenda.values()) {
  lista.sort((a, b) => (a.hora ? minutos(a.hora) : 1e4) - (b.hora ? minutos(b.hora) : 1e4)
    || ORDEM_CAT.get(a.cat) - ORDEM_CAT.get(b.cat)
    || String(a.codigo).localeCompare(String(b.codigo), 'pt', { numeric: true }));
}

// A agenda abre no dia de hoje; fora do período com atividades, abre no primeiro dia agendado.
const datasAgenda = eventosAgenda.map((e) => e.data).sort();
const ag = { vis: 'semana', data: HOJE >= datasAgenda[0] && HOJE <= datasAgenda.at(-1) ? HOJE : datasAgenda[0], ocultas: new Set() };
const evsDoDia = (d) => (porDiaAgenda.get(d) ?? []).filter((e) => !ag.ocultas.has(e.cat));

function rotuloEvento(e) {
  if (e.cat === 'instagram') return `${e.item.formato === 'Carrossel' ? 'Carrossel' : 'Estático'} · ${e.titulo}`;
  if (e.cat === 'whatsapp') return `${e.codigo} · ${e.titulo}`;
  if (e.cat === 'checkpoint') return `Checkpoint: ${e.titulo}`;
  if (e.cat === 'decisao') return `Decidir: ${e.titulo}`;
  return e.titulo;
}
function chipEv(e, { hora = false } = {}) {
  const feito = e.st.grupo === 'concluido' ? ' ev--feito' : e.st.grupo === 'atrasado' ? ' ev--atrasado' : '';
  const r = rotuloEvento(e);
  return `<button type="button" class="ev ev--${e.cat}${feito}" data-ev="${esc(e.id)}" title="${esc(r)}">${hora && e.hora ? `<b>${e.hora}</b>` : ''}<span>${esc(r)}</span></button>`;
}

/** Distribui eventos que se sobrepõem lado a lado (como no Google Agenda). */
function posicionar(lista) {
  const ordenados = [...lista].sort((a, b) => a.min - b.min);
  const saida = [];
  let grupo = [];
  let fimGrupo = -1;
  const fechar = () => {
    const faixas = [];
    for (const x of grupo) {
      let l = faixas.findIndex((fim) => fim <= x.min);
      if (l < 0) { l = faixas.length; faixas.push(0); }
      faixas[l] = x.min + DUR_MIN;
      x.faixa = l;
    }
    grupo.forEach((x) => { x.faixas = faixas.length; saida.push(x); });
    grupo = [];
  };
  for (const x of ordenados) {
    if (grupo.length && x.min >= fimGrupo) fechar();
    grupo.push(x);
    fimGrupo = Math.max(fimGrupo, x.min + DUR_MIN);
  }
  if (grupo.length) fechar();
  return saida;
}

const dia2 = (d) => String(paraData(d).getDate());
function tituloAgenda() {
  const d = paraData(ag.data);
  if (ag.vis === 'dia') return `${DIAS_LONGOS[d.getDay()]}, ${d.getDate()} de ${MESES_LONGOS[d.getMonth()].toLowerCase()} de ${d.getFullYear()}`;
  if (ag.vis === 'mes') return `${MESES_LONGOS[d.getMonth()]} de ${d.getFullYear()}`;
  const ini = paraData(segundaDe(ag.data));
  const fim = paraData(somarDias(segundaDe(ag.data), 6));
  return ini.getMonth() === fim.getMonth()
    ? `${ini.getDate()} – ${fim.getDate()} de ${MESES_LONGOS[fim.getMonth()].toLowerCase()} de ${fim.getFullYear()}`
    : `${ini.getDate()} ${MESES[ini.getMonth()]} – ${fim.getDate()} ${MESES[fim.getMonth()]} de ${fim.getFullYear()}`;
}

function periodoAgenda() {
  if (ag.vis === 'dia') return [ag.data, ag.data];
  if (ag.vis === 'semana') { const i = segundaDe(ag.data); return [i, somarDias(i, 6)]; }
  const d = paraData(ag.data);
  return [iso(new Date(d.getFullYear(), d.getMonth(), 1)), iso(new Date(d.getFullYear(), d.getMonth() + 1, 0))];
}
function resumoAgenda() {
  const [ini, fim] = periodoAgenda();
  const evs = [];
  for (let d = ini; d <= fim; d = somarDias(d, 1)) evs.push(...evsDoDia(d));
  const n = (c) => evs.filter((e) => e.cat === c).length;
  const partes = [
    [n('instagram'), 'publicação no feed', 'publicações no feed'],
    [n('whatsapp'), 'disparo', 'disparos'],
    [n('checkpoint'), 'checkpoint', 'checkpoints'],
    [n('decisao'), 'decisão', 'decisões'],
  ].filter(([q]) => q).map(([q, a, b]) => plural(q, a, b));
  const atrasados = evs.filter((e) => e.st.grupo === 'atrasado').length;
  const periodo = ag.vis === 'dia' ? 'Neste dia' : ag.vis === 'semana' ? 'Nesta semana' : 'Neste mês';
  return `${periodo}: ${partes.length ? partes.join(' · ') : 'nada agendado'}${atrasados ? ` · <b class="cal-resumo__alerta">${plural(atrasados, 'item atrasado', 'itens atrasados')}</b>` : ''}`;
}

function htmlSemana() {
  const ini = segundaDe(ag.data);
  const dias = [0, 1, 2, 3, 4, 5, 6].map((i) => somarDias(ini, i));
  const cab = dias.map((d) => `<button type="button" class="cal-cab${d === HOJE ? ' cal-cab--hoje' : ''}" data-cal-dia="${d}" aria-label="${DIAS_LONGOS[paraData(d).getDay()]}, ${dataLonga(d)}"><span>${SEMANA[paraData(d).getDay()]}</span><b>${dia2(d)}</b></button>`).join('');
  const diaTodo = dias.map((d) => {
    const lista = evsDoDia(d).filter((e) => !e.hora);
    return `<div class="cal-diatodo">${lista.slice(0, 3).map((e) => chipEv(e)).join('')}${lista.length > 3 ? `<button type="button" class="cal-mais" data-cal-dia="${d}">+${lista.length - 3} mais</button>` : ''}</div>`;
  }).join('');
  const horas = Array.from({ length: H1 - H0 }, (_, i) => `<div class="cal-hora"><span>${String(H0 + i).padStart(2, '0')}:00</span></div>`).join('');
  const colunas = dias.map((d) => {
    const timed = evsDoDia(d).filter((e) => e.hora).map((e) => ({ e, min: minutos(e.hora) }));
    const blocos = posicionar(timed).map(({ e, min, faixa, faixas }) =>
      `<div class="cal-evpos" style="top:${((min - H0 * 60) / 60) * ALT_H}px;height:${(DUR_MIN / 60) * ALT_H - 2}px;left:${(faixa / faixas) * 100}%;width:${100 / faixas}%">${chipEv(e, { hora: true })}</div>`).join('');
    return `<div class="cal-col${d === HOJE ? ' cal-col--hoje' : ''}">${blocos}</div>`;
  }).join('');
  const lista = dias.map((d) => htmlDiaLista(d)).join('');
  return `
    <div class="cal-semana" style="--linhas: ${H1 - H0}">
      <div class="cal-linha cal-linha--cab"><div></div>${cab}</div>
      <div class="cal-linha cal-linha--diatodo"><div class="cal-gutter">dia todo</div>${diaTodo}</div>
      <div class="cal-linha cal-linha--corpo"><div class="cal-horas">${horas}</div>${colunas}</div>
    </div>
    <div class="cal-lista">${lista}</div>`;
}

/** Lista simples de um dia (usada na semana no celular). */
function htmlDiaLista(d) {
  const evs = evsDoDia(d);
  return `
    <section class="cal-listadia${d === HOJE ? ' cal-listadia--hoje' : ''}">
      <button type="button" class="cal-listadia__cab" data-cal-dia="${d}"><span>${SEMANA[paraData(d).getDay()]}</span><b>${dia2(d)}</b><small>${evs.length ? plural(evs.length, 'atividade', 'atividades') : 'sem atividades'}</small></button>
      <div class="cal-listadia__itens">${evs.map((e) => chipEv(e, { hora: true })).join('')}</div>
    </section>`;
}

function htmlMes() {
  const d = paraData(ag.data);
  const primeiro = iso(new Date(d.getFullYear(), d.getMonth(), 1));
  const ultimo = iso(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  const ini = segundaDe(primeiro);
  const semanas = Math.ceil((diasEntre(ini, ultimo) + 1) / 7);
  const cels = [];
  for (let i = 0; i < semanas * 7; i++) {
    const dia = somarDias(ini, i);
    const evs = evsDoDia(dia);
    const fora = chaveMes(dia) !== chaveMes(primeiro);
    cels.push(`
      <div class="cal-cel${fora ? ' cal-cel--fora' : ''}${dia === HOJE ? ' cal-cel--hoje' : ''}">
        <button type="button" class="cal-celnum" data-cal-dia="${dia}" aria-label="${DIAS_LONGOS[paraData(dia).getDay()]}, ${dataLonga(dia)}${evs.length ? `, ${plural(evs.length, 'atividade', 'atividades')}` : ''}">${dia2(dia)}</button>
        <div class="cal-cel__chips">${evs.slice(0, 3).map((e) => chipEv(e, { hora: true })).join('')}${evs.length > 3 ? `<button type="button" class="cal-mais" data-cal-dia="${dia}">+${evs.length - 3} mais</button>` : ''}</div>
        <div class="cal-pontos" aria-hidden="true">${evs.slice(0, 6).map((e) => `<i class="ev--${e.cat}"></i>`).join('')}</div>
      </div>`);
  }
  const dows = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'].map((x) => `<div>${x}</div>`).join('');
  return `<div class="cal-mes"><div class="cal-mes__dows">${dows}</div><div class="cal-mes__celulas">${cels.join('')}</div></div>`;
}

function subPauta(e) {
  const x = e.item;
  if (e.cat === 'instagram') return `${esc(x.formato)} · ${esc(x.tema)}<br>CTA: <b>${esc(x.cta)}</b>`;
  if (e.cat === 'whatsapp') return `${esc(x.etapa)} · Médicos e Outras Especialidades · ${esc(x.formato)}<br>CTA: <b>${esc(x.cta)}</b>${x.aprovacao ? ` · Status: ${esc(x.aprovacao)}` : ''}`;
  if (e.cat === 'checkpoint') return `${esc(x.verificar)}<br>Se abaixo do esperado: ${esc(x.decisao)}`;
  return `${esc(x.impacto)}<br>${esc(x.tipo)} · ${esc(x.responsavel)}`;
}
function cartaoPauta(e) {
  const titulo = e.cat === 'instagram' || e.cat === 'whatsapp' ? `${esc(e.codigo)} · ${esc(e.titulo)}` : esc(rotuloEvento(e));
  return `
    <article class="pauta ev--${e.cat}">
      <div class="pauta__hora">${e.hora ?? '<span>dia todo</span>'}</div>
      <div class="pauta__corpo">
        <button type="button" class="pauta__titulo" data-ev="${esc(e.id)}">${titulo}</button>
        <p class="pauta__sub">${subPauta(e)}</p>
      </div>
      <div class="pauta__status">${tagStatus(e.st)}</div>
    </article>`;
}
function htmlDia() {
  const evs = evsDoDia(ag.data);
  if (!evs.length) return `<div class="cartao vazio">${icone('i-calendario')}<p class="f-legenda">Nada agendado para este dia.</p></div>`;
  const grupos = [
    ['Instagram', (e) => e.cat === 'instagram'],
    ['Disparos de WhatsApp', (e) => e.cat === 'whatsapp'],
    ['Checkpoints', (e) => e.cat === 'checkpoint'],
    ['Decisões com prazo', (e) => e.cat === 'decisao'],
  ];
  return `<div class="pauta-dia">${grupos.map(([nome, f]) => {
    const lista = evs.filter(f);
    return lista.length ? `<section class="pauta-grupo"><h3 class="pauta-grupo__titulo">${nome}<span>${lista.length}</span></h3>${lista.map(cartaoPauta).join('')}</section>` : '';
  }).join('')}</div>`;
}

function htmlMiniMes() {
  const d = paraData(ag.data);
  const primeiro = iso(new Date(d.getFullYear(), d.getMonth(), 1));
  const ultimo = iso(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  const ini = segundaDe(primeiro);
  const semanas = Math.ceil((diasEntre(ini, ultimo) + 1) / 7);
  const [pIni, pFim] = periodoAgenda();
  let dias = '';
  for (let i = 0; i < semanas * 7; i++) {
    const dia = somarDias(ini, i);
    const cls = ['mini__dia', chaveMes(dia) !== chaveMes(primeiro) && 'mini__dia--fora', dia === HOJE && 'mini__dia--hoje', dia === ag.data && 'mini__dia--sel', dia >= pIni && dia <= pFim && ag.vis === 'semana' && 'mini__dia--periodo'].filter(Boolean).join(' ');
    dias += `<button type="button" class="${cls}" data-cal-pick="${dia}" aria-label="${dataLonga(dia)}">${dia2(dia)}${evsDoDia(dia).length ? '<i></i>' : ''}</button>`;
  }
  return `
    <div class="mini">
      <div class="mini__cab"><b>${MESES_LONGOS[d.getMonth()]} ${d.getFullYear()}</b>
        <span><button type="button" class="mini__nav" data-cal-mini="-1" aria-label="Mês anterior">‹</button><button type="button" class="mini__nav" data-cal-mini="1" aria-label="Próximo mês">›</button></span></div>
      <div class="mini__grade">${['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((x) => `<span class="mini__dow">${x}</span>`).join('')}${dias}</div>
    </div>`;
}

function renderAgenda() {
  const alvo = $('#agenda');
  const corpo = ag.vis === 'dia' ? htmlDia() : ag.vis === 'mes' ? htmlMes() : htmlSemana();
  alvo.innerHTML = `
    <aside class="cal__lado">
      <div class="cal__mini">${htmlMiniMes()}</div>
      <details class="cal__filtros"${matchMedia('(min-width: 1025px)').matches ? ' open' : ''}>
        <summary>${icone('i-busca')}Tipos de atividade</summary>
        <ul class="cal-cats">${CATS_AG.map(([k, r]) => `<li><label><input type="checkbox" data-cal-cat="${k}"${ag.ocultas.has(k) ? '' : ' checked'}><i class="ev--${k}"></i><span>${r}</span></label></li>`).join('')}</ul>
      </details>
    </aside>
    <div class="cal__principal">
      <div class="cal-barra">
        <div class="cal-barra__nav">
          <button type="button" class="btn btn--secundario btn--p" data-cal-nav="0">Hoje</button>
          <button type="button" class="cal-seta" data-cal-nav="-1" aria-label="Anterior">‹</button>
          <button type="button" class="cal-seta" data-cal-nav="1" aria-label="Próximo">›</button>
          <h3 class="cal-barra__titulo">${tituloAgenda()}</h3>
        </div>
        <div class="segmento" role="group" aria-label="Visão da agenda">
          ${[['dia', 'Dia'], ['semana', 'Semana'], ['mes', 'Mês']].map(([v, r]) => `<button type="button" class="segmento__btn" data-cal-vis="${v}" aria-pressed="${ag.vis === v}">${r}</button>`).join('')}
        </div>
      </div>
      <p class="cal-resumo">${resumoAgenda()}</p>
      ${corpo}
    </div>`;
}

// ---------- Detalhe de uma atividade (janela) ----------
const dialogoAg = $('#dialogo-agenda');
const blocoCopia = (rotulo, texto, chave) => {
  copias.set(chave, texto);
  return `<div><span class="fase">${esc(rotulo)}</span><div class="detalhe__copy" style="margin-top: 8px">${comMarcadores(texto)}</div>
    <div class="detalhe__acoes"><button class="btn btn--secundario btn--p" type="button" data-copia="${esc(chave)}">${icone('i-copiar')}Copiar texto</button></div></div>`;
};
const detalhesVariacao = (titulo, corpo) => `<details style="margin-top: 4px"><summary style="cursor: pointer; font-weight: 600">${esc(titulo)}</summary><div style="display: grid; gap: 12px; margin-top: 12px">${corpo}</div></details>`;
function htmlComplementos(x, pre) {
  const enquete = x.enquete ? `<div><span class="fase">Enquete · publicar após a introdução (escolha única)</span>
    <div class="grade grade--2" style="margin-top: 8px">${[['Médicos', x.enquete.medicos], ['Outras Especialidades', x.enquete.outras]].map(([r, q]) =>
      `<div class="detalhe__copy"><b>${esc(r)}</b><br>${esc(q.pergunta)}<ol class="numerada" style="margin-top: 8px">${q.opcoes.map((o) => `<li><span>${esc(o)}</span></li>`).join('')}</ol></div>`).join('')}</div></div>` : '';
  const variacoes = (x.variacoes ?? []).map((v, i) => detalhesVariacao(v.titulo,
    blocoCopia('Versão M · Médicos', v.medicos, `${pre}:v${i}:m`) + blocoCopia('Versão O · Outras Especialidades', v.outras, `${pre}:v${i}:o`))).join('');
  const notas = (x.notas ?? []).map((t) => `<div class="aviso">${icone('i-info')}<div>${esc(t)}</div></div>`).join('');
  return enquete + variacoes + notas;
}
function htmlEvento(e) {
  const x = e.item;
  const d = paraData(e.data);
  const quando = `${DIAS_LONGOS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}${e.hora ? ` · ${e.hora}` : ''}`;
  let corpo = '';
  if (e.cat === 'instagram') {
    corpo = `
      <dl class="detalhe__dados dialogo__dados">${campo('Formato', x.formato)}${campo('Situação', x.situacao)}${campo('CTA principal', x.cta)}${campo('Função', x.funcao ?? x.tema)}</dl>
      ${x.textoArte ? `<dl class="detalhe__dados">${campo('Texto na arte', x.textoArte)}${campo('Apoio pequeno', x.apoio)}${campo('Visual', x.visual)}</dl>` : ''}
      ${x.laminas ? `<div><span class="fase">Texto exato das lâminas</span><ol class="numerada" style="margin-top: 8px">${x.laminas.map((l) => `<li><span>${esc(l)}</span></li>`).join('')}</ol></div>` : ''}
      ${x.arquivo ? `<dl class="detalhe__dados">${campo('Arquivos', x.arquivo)}${campo('Publicação', x.publicacao)}</dl>` : ''}
      ${x.framework ? `<dl class="detalhe__dados">${campo('Método', x.framework)}${campo('Visual', x.visual)}</dl>` : ''}
      ${blocoCopia('Legenda pronta', x.legenda, e.id)}`;
  } else if (e.cat === 'whatsapp') {
    corpo = `
      <dl class="detalhe__dados dialogo__dados">${campo('Etapa', x.etapa)}${campo('Objetivo', x.objetivo)}${campo('CTA', x.cta)}${campo('Formato', x.formato)}${campo('Execução', x.execucao)}${campo('Status', x.aprovacao)}${campo('Medição', x.medicao)}</dl>
      ${blocoCopia('Versão M · comunidade de Médicos', x.medicos, `${e.id}:m`)}
      ${blocoCopia('Versão O · comunidade de Outras Especialidades', x.outras, `${e.id}:o`)}
      ${htmlComplementos(x, e.id)}
      ${/\[LINK/.test(x.medicos + x.outras) ? `<div class="aviso">${icone('i-info')}<div><strong>Campos entre colchetes</strong>Os trechos entre colchetes só são enviados depois que o link for substituído e testado.</div></div>` : ''}`;
  } else if (e.cat === 'checkpoint') {
    corpo = `<dl class="detalhe__dados dialogo__dados">${campo('Canal', x.canal)}${campo('O que verificar', x.verificar)}${campo('Se abaixo do esperado', x.decisao)}</dl>`;
  } else {
    corpo = `<dl class="detalhe__dados dialogo__dados">${campo('Tipo', x.tipo)}${campo('Decisão necessária', x.decisao)}${campo('Impacto', x.impacto)}${campo('Responsável', x.responsavel)}${campo('Prazo', ddmm(x.prazo))}</dl>`;
  }
  const titulo = e.cat === 'instagram' || e.cat === 'whatsapp' ? `${e.codigo} · ${e.titulo}` : rotuloEvento(e);
  return `
    <div class="dialogo__topo ev--${e.cat}"><span>${esc(ROTULO_CAT[e.cat])}</span><button type="button" class="dialogo__fechar" data-fechar aria-label="Fechar">${icone('i-fechar')}</button></div>
    <div class="dialogo__corpo">
      <div><h3 class="f-titulo-3">${esc(titulo)}</h3><p class="f-legenda" style="margin-top: 4px">${esc(quando)} ${tagStatus(e.st)}</p></div>
      ${corpo}
    </div>`;
}
function abrirEvento(id) {
  const e = eventoPorId.get(id);
  if (!e) return;
  dialogoAg.innerHTML = htmlEvento(e);
  dialogoAg.querySelector('.dialogo__corpo').scrollTop = 0;
  if (!dialogoAg.open) dialogoAg.showModal();
}

function moverAgenda(n) {
  if (n === 0) { ag.data = HOJE; return; }
  if (ag.vis === 'mes') ag.data = somarMeses(ag.data, n);
  else ag.data = somarDias(ag.data, n * (ag.vis === 'dia' ? 1 : 7));
}
function somarMeses(data, n) {
  const d = paraData(data);
  const alvoMes = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const ultimo = new Date(alvoMes.getFullYear(), alvoMes.getMonth() + 1, 0).getDate();
  return iso(new Date(alvoMes.getFullYear(), alvoMes.getMonth(), Math.min(d.getDate(), ultimo)));
}
$('#agenda').addEventListener('click', (e) => {
  const ev = e.target.closest('[data-ev]');
  if (ev) { abrirEvento(ev.dataset.ev); return; }
  const dia = e.target.closest('[data-cal-dia]');
  if (dia) { ag.data = dia.dataset.calDia; ag.vis = 'dia'; renderAgenda(); $('#agenda [data-cal-vis="dia"]')?.focus(); return; }
  const pick = e.target.closest('[data-cal-pick]');
  if (pick) { ag.data = pick.dataset.calPick; renderAgenda(); return; }
  const mini = e.target.closest('[data-cal-mini]');
  if (mini) { ag.data = somarMeses(ag.data, Number(mini.dataset.calMini)); renderAgenda(); $(`#agenda [data-cal-mini="${mini.dataset.calMini}"]`)?.focus(); return; }
  const nav = e.target.closest('[data-cal-nav]');
  if (nav) { moverAgenda(Number(nav.dataset.calNav)); renderAgenda(); $(`#agenda [data-cal-nav="${nav.dataset.calNav}"]`)?.focus(); return; }
  const vis = e.target.closest('[data-cal-vis]');
  if (vis) { ag.vis = vis.dataset.calVis; renderAgenda(); $(`#agenda [data-cal-vis="${ag.vis}"]`)?.focus(); }
});
$('#agenda').addEventListener('change', (e) => {
  const cat = e.target.closest('[data-cal-cat]');
  if (!cat) return;
  cat.checked ? ag.ocultas.delete(cat.dataset.calCat) : ag.ocultas.add(cat.dataset.calCat);
  renderAgenda();
  $(`#agenda [data-cal-cat="${cat.dataset.calCat}"]`)?.focus();
});
dialogoAg.addEventListener('click', async (e) => {
  if (e.target === dialogoAg || e.target.closest('[data-fechar]')) { dialogoAg.close(); return; }
  const c = e.target.closest('[data-copia]');
  if (!c) return;
  try { await navigator.clipboard.writeText(copias.get(c.dataset.copia)); toast('Texto copiado'); }
  catch { toast('Não foi possível copiar — selecione o texto manualmente'); }
});

// ---------- Mensagens ----------
function renderMensagens() {
  const boasVindas = (D.boasVindas ?? []).map((b) => `
    <article class="cartao">
      <span class="fase">${esc(b.publico)} · ${esc(b.nota ?? 'enviada na entrada de cada membro')}</span>
      <h3 class="f-titulo-3" style="margin: 4px 0 12px">${esc(b.codigo)} · Boas-vindas</h3>
      ${blocoCopia('Mensagem', b.copy, `msg:${b.codigo}`)}
    </article>`).join('');
  const disparos = D.disparos.map((x) => {
    const d = paraData(x.data);
    return `<article class="cartao">
      <span class="fase">${DIAS_LONGOS[d.getDay()]}, ${ddmm(x.data)}${x.hora ? ` · ${esc(x.hora)}` : ''} · ${esc(x.etapa)}</span>
      <h3 class="f-titulo-3" style="margin: 4px 0 8px">${esc(x.codigo)} · ${esc(x.tema)}</h3>
      <dl class="detalhe__dados dialogo__dados">${campo('Objetivo', x.objetivo)}${campo('CTA', x.cta)}${campo('Formato', x.formato)}${campo('Execução', x.execucao)}${campo('Status', x.aprovacao)}${campo('Medição', x.medicao)}</dl>
      <div class="grade grade--2" style="margin-top: 12px">
        ${blocoCopia('Versão M · Médicos', x.medicos, `msg:${x.codigo}:m`)}
        ${blocoCopia('Versão O · Outras Especialidades', x.outras, `msg:${x.codigo}:o`)}
      </div>
      <div style="display: grid; gap: 12px; margin-top: 12px">${htmlComplementos(x, `msg:${x.codigo}`)}</div>
    </article>`;
  }).join('');
  const R = D.resultadosEnquetes;
  const resultados = R ? `<div class="secao"><div class="secao__cabeca"><div><span class="rotulo">resultados</span><h3 class="f-titulo-3">Como usar os resultados das enquetes</h3><p class="f-legenda">${esc(R.regra)}</p></div></div>
    <div style="display: grid; gap: 16px">${R.itens.map((it, i) => `<article class="cartao"><span class="fase">${esc(it.de)} → ${esc(it.para)} · ${ddmm(it.data)}</span><p class="f-legenda" style="margin: 4px 0 12px">${esc(it.regra)}</p>
      <div style="display: grid; gap: 12px">${it.opcoes.map((o, j) => blocoCopia(o.rotulo, o.texto, `res:${i}:${j}`)).join('')}</div></article>`).join('')}</div></div>` : '';
  $('#lista-mensagens').innerHTML = `
    <div class="secao"><div class="secao__cabeca"><div><span class="rotulo">entrada</span><h3 class="f-titulo-3">Boas-vindas</h3></div></div><div class="grade grade--2">${boasVindas}</div></div>
    <div class="secao"><div class="secao__cabeca"><div><span class="rotulo">outubro</span><h3 class="f-titulo-3">Disparos (${D.disparos.length})</h3></div></div><div style="display: grid; gap: 16px">${disparos}</div></div>
    ${resultados}`;
}
// ---------- Criativos ----------
const dh = (v) => (v ? `${v.slice(8, 10)}/${v.slice(5, 7)} · ${v.slice(11)}` : '—');
const cr = { sub: 'estaticos' };
const eAudio = (g) => /^áudio/i.test(g.formato);
const subCriativos = () => [
  ['estaticos', 'Estáticos e carrosséis', 'i-imagem', D.publicacoes.length],
  ['videos', 'Vídeos para gravar', 'i-video', D.roteiros.itens.filter((g) => !eAudio(g)).length],
  ['audios', 'Áudios para gravar', 'i-audio', D.roteiros.itens.filter(eAudio).length],
];
function cartaoGravacao(g) {
    return `<article class="cartao" style="display: grid; gap: 14px">
      <div><span class="fase">${esc(g.id)} · ${esc(g.quem)} · ${esc(g.formato)} · Prioridade ${g.prioridade}</span>
      <h3 class="f-titulo-3" style="margin-top: 4px">${esc(g.titulo)}</h3>
      <p class="f-legenda" style="margin-top: 4px">${esc(g.objetivo)} Encaixe: ${esc(g.encaixe)}</p></div>
      <dl class="detalhe__dados dialogo__dados">${campo('Captar', dh(g.captar))}${campo('Enviar até', dh(g.enviarAte))}${campo('Publicar', dh(g.publicar))}${campo('Canal', g.canal)}</dl>
      <div><span class="fase">Roteiro final para leitura</span><ol class="numerada" style="margin-top: 8px">${g.roteiro.map((l) => `<li><span>${esc(l)}</span></li>`).join('')}</ol>
        <div class="detalhe__acoes"><button class="btn btn--secundario btn--p" type="button" data-copia="rot:${esc(g.id)}">${icone('i-copiar')}Copiar roteiro</button></div></div>
      ${g.captacao ? `<dl class="detalhe__dados">${campo('Captação e edição', g.captacao)}</dl>` : ''}
      ${g.capa ? `<dl class="detalhe__dados">${campo('Capa', g.capa)}</dl>` : ''}
      ${g.legendaInstagram ? blocoCopia('Legenda Instagram', g.legendaInstagram, `leg:${g.id}`) : ''}
      <div class="grade grade--2">
        ${blocoCopia('Apoio WhatsApp · Médicos', g.apoioMedicos, `apm:${g.id}`)}
        ${blocoCopia('Apoio WhatsApp · Outras áreas', g.apoioOutras, `apo:${g.id}`)}
      </div>
      <dl class="detalhe__dados">${campo('Uso e reaproveitamento', g.uso)}</dl>
    </article>`;
}
function cartaoEstatico(x) {
  const d = paraData(x.data);
  copias.set(`est:${x.id}`, x.legenda);
  return `<article class="cartao" style="display: grid; gap: 14px">
    <div><span class="fase">${esc(x.id)} · ${esc(x.formato)} · ${DIAS_LONGOS[d.getDay()]}, ${ddmm(x.data)} · ${esc(x.hora)} · ${esc(x.situacao)}</span>
    <h3 class="f-titulo-3" style="margin-top: 4px">${esc(x.titulo)}</h3>
    <p class="f-legenda" style="margin-top: 4px">${esc(x.funcao ?? x.tema)}</p></div>
    <dl class="detalhe__dados dialogo__dados">${campo('CTA principal', x.cta)}${campo('Texto na arte', x.textoArte)}${campo('Apoio pequeno', x.apoio)}${campo('Visual', x.visual)}${campo('Método', x.framework)}</dl>
    ${x.laminas ? `<div><span class="fase">Texto exato das lâminas</span><ol class="numerada" style="margin-top: 8px">${x.laminas.map((l) => `<li><span>${esc(l)}</span></li>`).join('')}</ol></div>` : ''}
    ${x.legenda ? blocoCopia('Legenda pronta', x.legenda, `est:${x.id}`) : ''}
  </article>`;
}
function renderCriativos() {
  const R = D.roteiros;
  const O = R.orientacoes;
  const orient = `<article class="cartao" style="display: grid; gap: 12px">
    <h3 class="f-titulo-3">Como pedir e receber</h3>
    <p class="f-corpo">${esc(O.lotes)}</p>
    <ul class="lista-seta">${[...O.captacao, O.prioridade, O.encaixe].map((t) => `<li>${icone('i-check')}<span>${esc(t)}</span></li>`).join('')}</ul>
  </article>`;
  const apoio = `<div class="secao"><div class="secao__cabeca"><div><span class="rotulo">apoio</span><h3 class="f-titulo-3">Imagens e materiais de apoio</h3><p class="f-legenda">Pedidos opcionais que acompanham as gravações. Nenhum deles atrasa uma peça: cada um tem alternativa.</p></div></div>
    <div class="grade grade--3">${R.apoio.map((m) => `<article class="cartao" style="display: grid; gap: 8px"><span class="fase">${esc(m.id)}</span><h4 class="f-titulo-3">${esc(m.titulo)}</h4><p class="f-corpo">${esc(m.instrucao)}</p><p class="f-legenda"><b>Alternativa:</b> ${esc(m.alternativa)}</p></article>`).join('')}</div>
    <div class="aviso">${icone('i-info')}<div><strong>Modelo de tabela para G06, preparado pela FOCO</strong>${esc(O.modeloTabela)}</div></div></div>`;
  const subs = subCriativos();
  const barra = `<div class="segmento" role="group" aria-label="Tipo de criativo">${subs.map(([v, r, ic, n]) =>
    `<button type="button" class="segmento__btn" data-cr-sub="${v}" aria-pressed="${cr.sub === v}">${icone(ic)}${r} <span>${n}</span></button>`).join('')}</div>`;
  const lista = (itens, titulo) => `<div class="secao"><div class="secao__cabeca"><div><span class="rotulo">${titulo}</span><h3 class="f-titulo-3">${itens.length} ${titulo}</h3></div></div><div style="display: grid; gap: 16px">${itens.map(cartaoGravacao).join('')}</div></div>`;
  let corpo;
  if (cr.sub === 'estaticos') corpo = `<div class="secao"><div class="secao__cabeca"><div><span class="rotulo">feed do instagram</span><h3 class="f-titulo-3">Estáticos e carrosséis de outubro</h3><p class="f-legenda">Arte, texto exato e legenda pronta de cada publicação do feed, em ordem de data.</p></div></div><div style="display: grid; gap: 16px">${D.publicacoes.map(cartaoEstatico).join('')}</div></div>`;
  else if (cr.sub === 'videos') corpo = orient + lista(R.itens.filter((g) => !eAudio(g)), 'vídeos') + apoio;
  else corpo = orient + lista(R.itens.filter(eAudio), 'áudios');
  $('#lista-criativos').innerHTML = barra + `<div style="display: grid; gap: 24px">${corpo}</div>`;
  for (const g of R.itens) copias.set(`rot:${g.id}`, g.roteiro.join('\n\n'));
}
$('#lista-criativos').addEventListener('click', (e) => {
  const b = e.target.closest('[data-cr-sub]');
  if (!b) return;
  cr.sub = b.dataset.crSub;
  renderCriativos();
  $(`#lista-criativos [data-cr-sub="${cr.sub}"]`)?.focus();
});
async function copiarDoPainel(e) {
  const c = e.target.closest('[data-copia]');
  if (!c) return;
  try { await navigator.clipboard.writeText(copias.get(c.dataset.copia)); toast('Texto copiado'); }
  catch { toast('Não foi possível copiar — selecione o texto manualmente'); }
}
$('#lista-mensagens').addEventListener('click', copiarDoPainel);
$('#lista-criativos').addEventListener('click', copiarDoPainel);

// ---------- Montagem ----------
renderCabecalho();
renderFunil();
renderFrentes();
renderDecisoes();
renderOperacao();
renderAgenda();
renderMensagens();
renderCriativos();
atualizarContadores();

$('#rodape-fonte').textContent = `Atualizado em ${D.atualizadoEm.split('-').reverse().join('/')} · dados/hls.json`;
$('#carregando').hidden = true;
$('#app').hidden = false;
trocarAba(location.hash.slice(1));
