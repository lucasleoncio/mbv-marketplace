# 🔗 Pagamento real com NTR (on-chain) — guia de configuração

Este guia liga o checkout em **NTR** à blockchain **Polygon**. O cliente paga com a própria carteira (**MetaMask**), e o servidor **confirma na rede** antes de liberar o pedido. Nada de chaves privadas no app — modelo **não-custodial**.

> **Regra de ouro:** teste **primeiro na testnet (Polygon Amoy)**, sem dinheiro real. Só depois aponte para a mainnet.

---

## Como funciona

1. No checkout, o cliente escolhe **NTR** → o pedido é criado como *aguardando pagamento*.
2. Na tela do pedido, ele clica em **Conectar carteira e pagar** → a MetaMask envia o NTR para a **carteira da loja**.
3. O servidor lê a transação na Polygon e confirma: token certo, valor certo, recebido pela loja, com confirmações. Aí o pedido vira **pago**.

Sem as variáveis `NTR_CONTRACT` e `STORE_WALLET`, o app fica no **modo simulado** (saldo interno). Preenchendo-as, o NTR vira **pagamento real on-chain**.

---

## Parte 1 — Testar na Polygon Amoy (testnet, recomendado)

**Você vai precisar de:** MetaMask instalada e **duas contas** (uma "cliente" e uma "loja").

1. **Adicione a rede Amoy na MetaMask.** Acesse `chainlist.org`, ative "Testnets", procure **Polygon Amoy** e clique em *Add to MetaMask*. (O próprio site também adiciona a rede ao pagar.)
2. **Pegue POL de teste** (para as taxas) num faucet de Amoy, ex.: faucet da Polygon, da Alchemy ou da Chainlink. Envie para a conta "cliente".
3. **Implante o token de teste** `contracts/TestNTR.sol`:
   - Abra `remix.ethereum.org` → crie o arquivo e cole o conteúdo de `TestNTR.sol`.
   - *Solidity Compiler* → compile (0.8.20+).
   - *Deploy & Run* → Environment = **Injected Provider - MetaMask** (rede **Amoy**, conta "cliente") → **Deploy**.
   - Copie o **endereço do contrato** publicado (`0x...`). O deployer já recebe 1.000.000 tNTR.
4. **Configure as variáveis de ambiente** (no Render: *Environment*; local: um arquivo `.env` ou export no terminal):

   ```
   CHAIN_ID=80002
   CHAIN_NAME=Polygon Amoy (testnet)
   RPC_URL=https://rpc-amoy.polygon.technology
   EXPLORER_URL=https://amoy.polygonscan.com
   NATIVE_SYMBOL=POL
   NTR_CONTRACT=0xSEU_ENDERECO_DO_TESTNTR
   NTR_DECIMALS=18
   STORE_WALLET=0xSUA_CARTEIRA_DA_LOJA
   MIN_CONFIRMATIONS=1
   RATE_BRL_PER_NTR=9.36
   ```
5. **Reinicie o servidor.** No checkout, **NTR** agora abre a MetaMask. Faça uma compra de teste com a conta "cliente" — o tNTR vai para a carteira da loja e o pedido é confirmado automaticamente. ✅

> Dica: a tela do pedido tem um campo "Já paguei? Cole o hash" para reverificar caso a confirmação demore.

---

## Parte 2 — Ir para produção (mainnet Polygon)

Quando o teste estiver redondo, troque as variáveis para a rede real:

```
CHAIN_ID=137
CHAIN_NAME=Polygon
RPC_URL=https://polygon-rpc.com        # melhor: um endpoint Alchemy/Infura (grátis)
EXPLORER_URL=https://polygonscan.com
NATIVE_SYMBOL=POL
NTR_CONTRACT=0xENDERECO_REAL_DO_NTR    # o contrato oficial do NTR na Polygon
NTR_DECIMALS=18                         # confirme os decimais do contrato real
STORE_WALLET=0xCARTEIRA_REAL_DA_LOJA
MIN_CONFIRMATIONS=3
RATE_BRL_PER_NTR=9.36
```

- Confirme **endereço e decimais** do NTR real (no Polygonscan).
- Recomendo um **RPC dedicado** (Alchemy/Infura) — o público pode ter limites.
- Guarde a **seed da carteira da loja** offline. O app nunca a usa nem a armazena.

---

## ⚠️ Antes de cobrar de verdade — pontos de atenção

O whitepaper do NTR traz afirmações que pedem **revisão antes do lançamento comercial**:

- **Base "científica" do valor:** o documento associa o token à "presença de neutrinos" interagindo com o solo. Isso **não tem fundamento físico** (neutrinos praticamente não interagem com a matéria) e pode comprometer a credibilidade. Sugiro remover/reescrever essa justificativa.
- **Auditoria do smart contract:** consta como *futura*. Faça a **auditoria antes** de mover valores reais.
- **Enquadramento legal (CVM/ativos virtuais):** ICO, preço fixo e captação de investidores podem atrair regulação mesmo com o rótulo "utility". **Consulte um advogado** especializado (Lei 14.478/22) e um contador antes de vender na mainnet.
- **Lastro/cote:** garanta prova de reserva e regra de resgate claras para sustentar o valor de R$ 9,36.

Esses pontos não impedem o teste em testnet — apenas devem estar resolvidos antes de receber dinheiro real.
