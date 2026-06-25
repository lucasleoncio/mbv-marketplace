// Verificação de pagamentos on-chain do NTR (ERC-20 na Polygon).
// O servidor NÃO guarda chaves — apenas LÊ a blockchain para confirmar
// que o cliente transferiu o NTR para a carteira da loja.
const { ethers } = require('ethers');
const { CHAIN, TOKEN } = require('../config');

const TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');
const IFACE = new ethers.Interface(['event Transfer(address indexed from, address indexed to, uint256 value)']);

function provider() {
  return new ethers.JsonRpcProvider(CHAIN.rpcUrl);
}

// Converte um valor em NTR (ex.: 32.4) para unidades-base (BigInt).
function toBaseUnits(amountNtr) {
  const s = Number(amountNtr || 0).toFixed(Math.min(CHAIN.ntrDecimals, 8));
  return ethers.parseUnits(s, CHAIN.ntrDecimals);
}

// PURA (testável offline): soma o NTR transferido para a carteira da loja nos logs.
function extractTransferToStore(logs, tokenAddr, storeAddr) {
  let total = 0n, from = null;
  for (const log of logs || []) {
    if (!log.address || log.address.toLowerCase() !== String(tokenAddr).toLowerCase()) continue;
    if (!log.topics || !log.topics[0] || log.topics[0].toLowerCase() !== TRANSFER_TOPIC.toLowerCase()) continue;
    let parsed;
    try { parsed = IFACE.parseLog({ topics: log.topics, data: log.data }); } catch { continue; }
    if (parsed && parsed.args.to.toLowerCase() === String(storeAddr).toLowerCase()) {
      total += parsed.args.value;
      from = parsed.args.from;
    }
  }
  return { total, from };
}

// Verifica um txHash: confirma sucesso, confirmações e valor recebido pela loja.
async function verifyPayment(txHash, expectedBaseUnits) {
  if (!CHAIN.onchainEnabled) return { ok: false, reason: 'Pagamento on-chain não está configurado.' };
  const p = provider();

  let receipt;
  try { receipt = await p.getTransactionReceipt(txHash); }
  catch (_) { return { ok: false, reason: 'Não consegui consultar a blockchain agora. Tente novamente em instantes.' }; }
  if (!receipt) return { ok: false, reason: 'Transação ainda não encontrada na rede. Aguarde alguns segundos e verifique de novo.' };
  if (Number(receipt.status) !== 1) return { ok: false, reason: 'A transação falhou na blockchain.' };

  let head;
  try { head = await p.getBlockNumber(); } catch (_) { head = receipt.blockNumber; }
  const confirmations = head - receipt.blockNumber + 1;
  if (confirmations < CHAIN.minConfirmations)
    return { ok: false, reason: `Aguardando confirmações na rede (${confirmations}/${CHAIN.minConfirmations})…` };

  const { total, from } = extractTransferToStore(receipt.logs, CHAIN.ntrContract, CHAIN.storeWallet);
  if (total === 0n)
    return { ok: false, reason: 'Não encontramos transferência de NTR para a carteira da loja nessa transação.' };

  const tolerance = toBaseUnits(CHAIN.feeToleranceNtr || 0);
  const minAccept = expectedBaseUnits > tolerance ? expectedBaseUnits - tolerance : expectedBaseUnits;
  if (total < minAccept)
    return {
      ok: false,
      reason: `Valor recebido (${ethers.formatUnits(total, CHAIN.ntrDecimals)} NTR) é menor que o esperado (${ethers.formatUnits(expectedBaseUnits, CHAIN.ntrDecimals)} NTR).`
    };

  return { ok: true, amount: ethers.formatUnits(total, CHAIN.ntrDecimals), from, blockNumber: receipt.blockNumber };
}

// Configuração pública (segura) para o frontend.
function publicConfig() {
  return {
    enabled: CHAIN.onchainEnabled,
    chainId: CHAIN.chainId,
    chainIdHex: '0x' + Number(CHAIN.chainId).toString(16),
    name: CHAIN.name,
    rpcUrl: CHAIN.rpcUrl,
    explorer: CHAIN.explorer,
    nativeSymbol: CHAIN.nativeSymbol,
    minConfirmations: CHAIN.minConfirmations,
    brlPerToken: TOKEN.brlPerToken,
    token: { address: CHAIN.ntrContract, decimals: CHAIN.ntrDecimals, symbol: TOKEN.symbol },
    store: CHAIN.storeWallet
  };
}

module.exports = { provider, toBaseUnits, extractTransferToStore, verifyPayment, publicConfig };
