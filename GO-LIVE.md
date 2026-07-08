# Go-live do MBV Marketplace

Hoje o app roda em **MODO DEMONSTRAÇÃO** (`MBV_DEMO_MODE` diferente de `false`):
pagamentos podem ser simulados e o segredo padrão é tolerado (com aviso no log).

Para ir ao ar "pra valer", defina as variáveis abaixo no **Render → Environment**.
Ao ligar `MBV_DEMO_MODE=false`, o app passa a **exigir** o essencial e a **bloquear pagamentos
simulados** (nada de pedido aprovado sem cobrança real).

## 1. Obrigatórias
| Variável | Para quê |
|---|---|
| `MBV_DEMO_MODE=false` | Liga o modo produção (bloqueia pagamento simulado). |
| `JWT_SECRET` | Segredo forte do login. **Sem ele o app não sobe** no go-live. Gere com: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `APP_URL` | URL pública (ex.: `https://mbv-marketplace.onrender.com` ou domínio próprio). Usada em e-mails e no retorno do pagamento. |

## 2. Pagamentos
**Mercado Pago (Cartão/Pix reais):**
- `MP_ACCESS_TOKEN` — `APP_USR-...` (produção) ou `TEST-...` (teste)
- `MP_PUBLIC_KEY`
- `MP_WEBHOOK_SECRET` — valida a assinatura do webhook
- No painel do Mercado Pago, aponte o webhook para: `{APP_URL}/api/webhooks/mercadopago`

**NTR on-chain (Polygon) — opcional:**
- `CHAIN_ID=137`, `CHAIN_NAME`, `RPC_URL`, `EXPLORER_URL`, `NATIVE_SYMBOL=POL`
- `NTR_CONTRACT=0x...` (token), `STORE_WALLET=0x...` (carteira da loja)
- Sem `NTR_CONTRACT` + `STORE_WALLET`, o pagamento em NTR fica indisponível no go-live.

## 3. E-mail (Resend)
- `RESEND_API_KEY=re_...`
- `EMAIL_FROM="MBV — Movimento Brasil Verde <no-reply@seudominio>"`

## 4. Opcionais
- `GA_ID=G-XXXXXXX` (Google Analytics)
- `ALLOWED_ORIGINS=https://a,https://b` (CORS; o padrão já inclui as URLs do MBV)

## 5. Persistência dos dados (IMPORTANTE)
No plano free os dados **zeram a cada deploy**. Escolha um caminho:
- **Rápido (SQLite + disco):** adicione um *Render Disk* e defina `MBV_DATA_DIR=/var/data`. Os dados passam a persistir (não escala para múltiplas instâncias).
- **ESCOLHIDO (decisão de 08/07/2026) — PlanetScale Postgres, plano PS-5 (US$ 5/mês):**
  1. Crie a conta em planetscale.com e um banco Postgres **PS-5 single node** (ref.: planetscale.com/blog/5-dollar-planetscale).
  2. **Região:** escolha a mesma região/mais próxima do serviço no Render (menor latência).
  3. Copie a connection string do painel e defina `DATABASE_URL=postgres://...` (TLS já vem exigido na URL da PlanetScale).
  4. A migração do código (camada de dados async + dialeto PG, com SQLite continuando como fallback local/demo) é a Leva 9 do plano do comitê — o app só usa Postgres quando `DATABASE_URL` existir.
  - Nota: PS-5 é nó único (sem alta disponibilidade) — adequado ao estágio atual; upgrade para HA na própria PlanetScale sem migração.

O app avisa no boot se detectar armazenamento possivelmente efêmero.

## Checklist
1. [ ] `JWT_SECRET`, `APP_URL`, `MBV_DEMO_MODE=false`
2. [ ] Mercado Pago (token + public key + webhook secret) e webhook configurado
3. [ ] Resend (`RESEND_API_KEY` + `EMAIL_FROM`)
4. [ ] Persistência: PlanetScale Postgres PS-5 + `DATABASE_URL` (decisão 08/07/2026; código = Leva 9)
5. [ ] (Opcional) NTR mainnet, `GA_ID`, domínio próprio
6. [ ] Deploy e conferir `GET /api/health` → `{ ok: true, db: "up", demo: false }`
7. [ ] Rodar `npm test` (núcleo financeiro)

## O que já está pronto para o go-live (nesta entrega)
- Cabeçalhos de segurança (Helmet + CSP), CORS restrito, rate limiting.
- `JWT_SECRET` forte exigido em produção; senhas com bcrypt assíncrono.
- Pagamento on-chain idempotente (índice único em `tx_hash`); pagamento simulado bloqueado em produção.
- Webhook do Mercado Pago com validação de assinatura (quando há `MP_WEBHOOK_SECRET`).
- Upload de imagem validado por tipo e conteúdo.
- `/api/health` com checagem de banco; erros não vazam detalhes internos.
- Testes do núcleo financeiro (`npm test`).
