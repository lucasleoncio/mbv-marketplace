# 🌱 MBV — Marketplace do Agronegócio Sustentável

Marketplace e e-commerce completo de insumos sustentáveis (linha COT/PVE, fertilizantes, sementes, energia solar) com o **utility token Neutrotan (NTR)**. Tem área **administrativa** (cadastro de produtos, pedidos, cupons) e área **cliente** (catálogo, carrinho, checkout). Pagamento por **Cartão, Pix e Neutrotan (NTR)**.

MBV — **Movimento Brasil Verde** · Token *Neutrotan (NTR)* — utility token ERC-20 na rede **Polygon**, com lastro real em cote (ref.: movimentobrasilverde.com / neutrotan.com).

---

## ▶️ Como rodar (passo a passo)

Pré-requisito: ter o **Node.js 18 ou superior** instalado ([nodejs.org](https://nodejs.org)).

1. Abra o Terminal e entre na pasta do projeto:
   ```bash
   cd "caminho/para/MBV/marketplace"
   ```
2. Instale as dependências (só na primeira vez):
   ```bash
   npm install
   ```
3. Inicie o servidor:
   ```bash
   npm start
   ```
4. Abra no navegador: **http://localhost:4000**

O banco de dados é criado e populado automaticamente na primeira execução.

### Contas de demonstração

| Perfil  | E-mail            | Senha       |
|---------|-------------------|-------------|
| Admin   | `admin@mbv.com`   | `admin123`  |
| Cliente | `cliente@mbv.com` | `cliente123` (já vem com 2.150 NTR para testar o pagamento em cripto) |

> Você também pode criar uma conta nova de cliente — ela ganha **150 NTR** de bônus de boas-vindas.

---

## 🛒 Funcionalidades

### Área do cliente
- **Home** com destaques, categorias e banners.
- **Catálogo** com busca, filtro por categoria, faixa de preço e ordenação.
- **Página de produto** com selos ecológicos, avaliações e produtos relacionados.
- **Carrinho** com ajuste de quantidade e cupom.
- **Checkout** com endereço de entrega e 3 formas de pagamento.
- **Favoritos**, **avaliações** e **histórico de pedidos**.
- **Carteira Neutrotan (NTR)**: saldo, extrato, recarga e cotação.

### Área administrativa (`/admin` — só para admin)
- **Painel** com receita, pedidos, clientes, CO₂ evitado, gráfico de vendas, mais vendidos e estoque baixo.
- **Produtos**: criar, editar, ativar/desativar, com **upload de imagem**.
- **Pedidos**: ver todos e atualizar status (em processamento → enviado → entregue / cancelado).
- **Cupons**: criar/ativar/excluir (ex.: `COINMAX`).
- **Clientes**: lista com gastos e saldo MBV.

### Pagamentos
| Método | Como funciona aqui | Para produção |
|--------|--------------------|---------------|
| **Cartão** | Valida os dados e aprova (ambiente de demonstração; nenhum dado é salvo) | Plugar gateway em `server/routes/orders.js` (ex.: Stripe / Mercado Pago) |
| **Pix** | Gera código copia-e-cola e confirma o pagamento manualmente | Integrar PSP/banco para gerar o QR e receber o webhook de confirmação |
| **Neutrotan (NTR)** | Simulado (saldo interno) **ou real on-chain**, se configurado | **Já incluído:** MetaMask + Polygon — ative em `BLOCKCHAIN.md` |

> **🔗 Pagamento real com o token:** o checkout em NTR já integra com a carteira do cliente (**MetaMask**) na rede **Polygon**, com verificação on-chain no servidor (não-custodial). Comece pela **testnet (Amoy)** — passo a passo em **`BLOCKCHAIN.md`**.

Cupons de exemplo já cadastrados: **`COINMAX`** (10% + 20 MBV de cashback), **`SAFRA15`** (15% acima de R$ 500), **`PLANTAR50`** (R$ 50 acima de R$ 300).

---

## 🪙 Neutrotan (NTR) — o token do projeto

O app implementa a economia do utility token *Neutrotan (NTR)*, conforme o site oficial (neutrotan.com):
- Carteira por usuário com saldo, endereço e extrato de transações.
- Cotação fixa **1 NTR = R$ 9,36** (valor de referência do whitepaper; ajustável via `RATE_BRL_PER_NTR`).
- **Lastro real em cote** (composto orgânico vendável) — base de valor do token.
- Recarga (on-ramp) simulada — em produção o crédito ocorre após pagamento real.
- Desconto e cashback ao pagar com NTR, incentivando o uso do token.

Quando o contrato ERC-20 estiver na mainnet (**Polygon**), basta substituir a carteira interna pela carteira on-chain.

---

## 🗂️ Estrutura

```
marketplace/
├── server/                 # Backend (Node + Express + SQLite)
│   ├── index.js            # Servidor e rotas
│   ├── db.js               # Banco SQLite (+ fallback automático)
│   ├── seed.js             # Dados de demonstração
│   ├── config.js           # Configurações (token, frete, JWT)
│   ├── lib/                # Carteira (ledger) e precificação
│   ├── middleware/         # Autenticação e papéis
│   └── routes/             # auth, products, cart, orders, wallet, coupons, admin
└── public/                 # Frontend (HTML, CSS e JS — sem build)
    ├── index.html
    ├── css/styles.css
    └── js/                 # api, store, components, app
```

Tecnologias: **Node.js, Express, SQLite (better-sqlite3), JWT, bcrypt**. Frontend em JavaScript puro (sem etapa de build), responsivo.

---

## ⚙️ Configuração

Edite `server/config.js` para ajustar: segredo do JWT, cotação e regras do token NTR, valor do frete e frete grátis.
Para produção, defina variáveis de ambiente: `JWT_SECRET` e `PORT`.

Recriar os dados de demonstração do zero:
```bash
npm run seed
```

---

## ☁️ Deploy no Render

O app sobe como um **Web Service** no Render (já respeita a variável `PORT`).

1. Suba o código para um repositório no **GitHub** (a pasta `marketplace`).
2. No Render: **New → Web Service** e conecte o repositório.
3. Configure:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free (ou Starter, para dados persistentes)
   - **Root Directory:** `marketplace` (apenas se o repositório for a pasta MBV inteira)
4. Em **Environment**, adicione:
   - `NODE_VERSION` = `22`
   - `JWT_SECRET` = uma string longa e aleatória
5. **Create Web Service** — em ~2 min o Render entrega a URL pública.

> Atalho: existe um `render.yaml` na pasta. Em **New → Blueprint**, o Render lê toda a configuração automaticamente.

### ⚠️ Persistência de dados (importante)

No plano **Free**, o disco é **efêmero**: o banco SQLite e as imagens enviadas **são apagados a cada deploy, reinício ou hibernação**. Perfeito para demonstração; inadequado para dados reais.

Para manter os dados (requer plano **pago**):
- Adicione um **Disk** ao serviço (ex.: mount path `/var/data`, 1 GB).
- Defina as variáveis `MBV_DATA_DIR=/var/data` e `MBV_UPLOAD_DIR=/var/data/uploads`.

Para escala/produção de verdade, o ideal é migrar o banco para **Postgres** (gerenciado pelo Render).

> O serviço Free também **hiberna** após ~15 min sem acesso — a primeira visita seguinte leva alguns segundos para responder.

---

## 🔌 Ativar pagamento e e-mail reais

O app roda em modo demonstração e **ativa as integrações sozinho** quando as variáveis existirem (no Render: *Environment*). Sem elas, nada quebra: cartão/Pix ficam simulados e os e-mails apenas aparecem no log.

**Mercado Pago (Cartão + Pix):**
- `MP_ACCESS_TOKEN` = seu Access Token (use o de **TESTE**, começa com `TEST-`, para validar).
- No painel do Mercado Pago, aponte o **webhook** de pagamentos para `https://mbv-marketplace.onrender.com/api/webhooks/mercadopago`.
- No checkout, o cliente é levado ao ambiente seguro do Mercado Pago (cartão, Pix, boleto) e o pedido é **confirmado automaticamente** pelo webhook.

**E-mails (Resend):**
- `RESEND_API_KEY` = sua chave (`re_...`).
- `EMAIL_FROM` = ex.: `MBV <no-reply@movimentobrasilverde.com>` (verifique o domínio no Resend).
- Ativa os e-mails de **confirmação de pedido** e de **recuperação de senha**.

---

## 🛠️ Resolução de problemas

- **Mensagens vermelhas de `better-sqlite3` / `node-gyp` durante o `npm install`**: são **esperadas e inofensivas** se o seu Mac não tem o compilador do Xcode. Esse pacote é **opcional** — quando ele não compila, o app usa automaticamente o **SQLite embutido no Node** (Node 22.13+/23.4+/24+). O `npm install` termina normalmente e o `npm start` funciona.
  - Se quiser usar o driver nativo (mais rápido), instale o compilador e reinstale:
    ```bash
    xcode-select --install
    rm -rf node_modules package-lock.json && npm install
    ```
- **`Cannot find module 'express'`**: a instalação anterior foi interrompida. Refaça limpando antes:
  ```bash
  rm -rf node_modules package-lock.json
  npm install
  npm start
  ```
- **Node 22.5 a 23.3** (banco embutido exige flag): use `npm run start:builtin`.
- **Porta 4000 ocupada**: rode `PORT=4001 npm start` e acesse `http://localhost:4001`.

---

© 2026 MBV — Projeto Petrus. Ambiente de demonstração; pagamentos prontos para integração real.
