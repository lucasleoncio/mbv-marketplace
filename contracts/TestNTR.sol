// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Token ERC-20 de TESTE para validar o checkout on-chain na testnet (Polygon Amoy).
// NÃO é o NTR real — serve só para testar o fluxo sem dinheiro de verdade.
// Deploy pelo Remix (remix.ethereum.org) com "Injected Provider - MetaMask" na rede Amoy.
//
// Ao publicar, o deployer recebe 1.000.000 tNTR. Qualquer carteira pode chamar
// faucet() para receber 1.000 tNTR e testar pagamentos.

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestNTR is ERC20 {
    constructor() ERC20("Test Neutrotan", "tNTR") {
        _mint(msg.sender, 1_000_000 * 10 ** decimals());
    }

    // Torneira de teste: pega 1.000 tNTR para qualquer carteira.
    function faucet() external {
        _mint(msg.sender, 1000 * 10 ** decimals());
    }
}
