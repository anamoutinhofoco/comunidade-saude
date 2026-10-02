# HLS — painel e planejamento

Site estático (HTML/CSS/JS, sem framework) no design system **Foco**, publicado no Vercel, com duas páginas:

| Rota | Conteúdo |
|---|---|
| `/` | **Painel de status** da HLS, com abas: **Visão geral** (funil, situação por frente, últimos e próximos marcos) · **Agenda** (calendário em dia, semana e mês com as publicações do feed, os disparos de WhatsApp, checkpoints, marcos e decisões com prazo; clique na atividade para ver legenda, versões M e O da mensagem e botão de copiar) · **Marcos** (Lives, prazos e entregas com data) · **Decisões** (o que destrava a operação) · **Diagnóstico** (problema → resposta por frente) · **Operação** (fluxo insumos → publicação e regras). Cada aba tem endereço próprio (ex.: `/#decisoes`). |
| `/planejamento` | **Planejamento de outubro de 2026**: direção do mês, público, feed do Instagram, disparos das comunidades, integração, operação, medição e dependências. Tem botão "Salvar em PDF". |

## Como os dados funcionam

A fonte de verdade do painel é **`dados/hls.json`**. No build, `scripts/gerar-dados.mjs` valida o arquivo (ids duplicados, datas fora do formato `AAAA-MM-DD`, marco ligado a frente inexistente) e gera `public/dados/hls.json`.

| Bloco | O que é |
|---|---|
| `frentes` | Situação, estado e próximo passo de cada frente (`tom`: `aprovado`, `revisao`, `ajuste`, `atrasado`, `neutro`). |
| `marcos` | Lives, prazos e entregas com data. `status` livre. |
| `decisoes` | Decisões em aberto. `prazo` é opcional; `status` `Aprovado`, `Resolvido` ou `Confirmado` fecha a decisão. |
| `publicacoes` | Feed do Instagram (data, hora, formato, texto da arte, legenda, lâminas). Alimenta a Agenda. |
| `disparos` | Disparos de WhatsApp (C01 a C09) com versão `medicos` e `outras`, status e alternativa sem link. Alimenta a Agenda. |
| `boasVindas` | Mensagens B01-M e B01-O, enviadas na entrada de cada membro (sem data). |
| `checkpoints` | Verificações de métricas com data. Alimenta a Agenda. |
| `diagnostico` | Linhas da aba Diagnóstico. |
| `operacao` | Fluxo e regras da aba Operação. |

### Status dos marcos

| Grupo | Exemplos |
|---|---|
| Concluído | `Realizado`, `Publicado`, `Enviado`, `Aprovado`, `Concluído` |
| Em andamento | `Em produção`, `Aguardando aprovação`, `Ajuste`, `Programado` |
| A confirmar | `A confirmar` (resultado ainda não registrado; não conta como atraso) |
| A fazer | `A fazer` (ou vazio) |
| Cancelado | `Cancelado` |

Itens "A fazer" ou "Em andamento" com data passada aparecem como **Atrasado**. Para revisar o painel numa data futura, use `?hoje=AAAA-MM-DD`.

## Rodar localmente

Requer Node 18+, sem dependências.

```bash
npm run dev      # gera o JSON e sobe em http://localhost:3100
npm run build    # só gera public/dados/hls.json
```

## Publicar no Vercel

Importe a pasta como projeto (framework **Other**); o `vercel.json` define build, saída e URLs limpas. As páginas enviam `noindex`. Ative **Deployment Protection** se o painel não deve ficar aberto.
