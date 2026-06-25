// Integração com carteira (MetaMask) para pagamento on-chain em NTR (Polygon).
// Não-custodial: o cliente assina a transação na própria carteira; o servidor só confirma.
const Web3Pay = (function () {
  const ERC20_ABI = [
    'function transfer(address to, uint256 amount) returns (bool)',
    'function balanceOf(address owner) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)'
  ];

  function hasWallet() { return typeof window.ethereum !== 'undefined'; }
  function hasEthers() { return typeof window.ethers !== 'undefined'; }

  // Garante que a carteira está na rede correta (troca ou adiciona).
  async function ensureNetwork(chain) {
    const hex = chain.chainIdHex;
    try {
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] });
    } catch (e) {
      const code = e && (e.code || (e.data && e.data.originalError && e.data.originalError.code));
      if (code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: hex,
            chainName: chain.name,
            nativeCurrency: { name: chain.nativeSymbol, symbol: chain.nativeSymbol, decimals: 18 },
            rpcUrls: [chain.rpcUrl],
            blockExplorerUrls: [chain.explorer]
          }]
        });
      } else { throw e; }
    }
  }

  async function connect(chain) {
    if (!hasWallet()) throw new Error('Carteira não encontrada. Instale a MetaMask (metamask.io) para pagar com NTR.');
    if (!hasEthers()) throw new Error('A biblioteca da carteira não carregou (verifique sua conexão e recarregue).');
    await window.ethereum.request({ method: 'eth_requestAccounts' });
    await ensureNetwork(chain);
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    return { provider, signer, address: await signer.getAddress() };
  }

  // Envia `amountNtrStr` NTR para a carteira da loja. Retorna o objeto da transação (tem .hash e .wait()).
  async function payNtr(chain, amountNtrStr) {
    const { signer, address } = await connect(chain);
    const erc20 = new ethers.Contract(chain.token.address, ERC20_ABI, signer);
    const amount = ethers.parseUnits(String(amountNtrStr), chain.token.decimals);
    try {
      const bal = await erc20.balanceOf(address);
      if (bal < amount) throw new Error('Saldo de NTR insuficiente na sua carteira.');
    } catch (e) {
      if (e && e.message && e.message.includes('insuficiente')) throw e;
      // se a leitura de saldo falhar, segue e deixa a própria carteira barrar
    }
    return erc20.transfer(chain.store, amount);
  }

  return { hasWallet, hasEthers, connect, payNtr };
})();
