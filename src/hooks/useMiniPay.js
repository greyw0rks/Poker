/**
 * hooks/useMiniPay.js
 *
 * Connects to the MiniPay wallet injected into window.ethereum.
 * Works both in MiniPay browser (auto-connects) and regular browser (manual).
 *
 * Returns:
 *   { address, isMiniPay, cusdBalance, isConnected, isLoading, connect, refreshBalance }
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPublicClient, createWalletClient, custom, http,
         getContract, formatUnits, parseUnits, encodeFunctionData } from 'viem';
import { celo, celoAlfajores } from 'viem/chains';

// ─── cUSD addresses ───────────────────────────────────────────────────────────
const CUSD = {
  mainnet:   '0x765DE816845861e75A25fCA122bb6898B8B1282a',
  alfajores: '0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1',
};

const STABLE_TOKEN_ABI = [
  { name: 'balanceOf',  type: 'function', stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }] },
  { name: 'approve',    type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }] },
  { name: 'transfer',   type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }] },
  { name: 'allowance',  type: 'function', stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }] },
];

const POKER_ESCROW_ABI = [
  { name: 'joinTable', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'tableId', type: 'uint256' }, { name: 'amount', type: 'uint256' }],
    outputs: [] },
];

const IS_TESTNET = process.env.NEXT_PUBLIC_NETWORK === 'alfajores';
const CHAIN      = IS_TESTNET ? celoAlfajores : celo;
const CUSD_ADDR  = IS_TESTNET ? CUSD.alfajores : CUSD.mainnet;

export function useMiniPay() {
  const [address,      setAddress]      = useState(null);
  const [isMiniPay,    setIsMiniPay]    = useState(false);
  const [isConnected,  setIsConnected]  = useState(false);
  const [isLoading,    setIsLoading]    = useState(false);
  const [cusdBalance,  setCusdBalance]  = useState('0.00');
  const [error,        setError]        = useState(null);
  const [clients,      setClients]      = useState({ public: null, wallet: null });

  // ── Initialize clients ────────────────────────────────────────────────────
  const initClients = useCallback((provider) => {
    const publicClient = createPublicClient({ chain: CHAIN, transport: http() });
    const walletClient = createWalletClient({ chain: CHAIN, transport: custom(provider) });
    setClients({ public: publicClient, wallet: walletClient });
    return { publicClient, walletClient };
  }, []);

  // ── Fetch cUSD balance ────────────────────────────────────────────────────
  const refreshBalance = useCallback(async (addr, publicClient) => {
    if (!addr || !publicClient) return;
    try {
      const bal = await publicClient.readContract({
        address: CUSD_ADDR,
        abi:     STABLE_TOKEN_ABI,
        functionName: 'balanceOf',
        args:    [addr],
      });
      setCusdBalance(parseFloat(formatUnits(bal, 18)).toFixed(2));
    } catch (e) {
      console.warn('Balance fetch failed:', e.message);
    }
  }, []);

  // ── Connect wallet ────────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      setError('No wallet found. Please open in MiniPay.');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const minipay = window.ethereum.isMiniPay;
      setIsMiniPay(!!minipay);

      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
        params: [],
      });

      const addr = accounts[0];
      setAddress(addr);
      setIsConnected(true);

      const { publicClient } = initClients(window.ethereum);
      await refreshBalance(addr, publicClient);

      return addr;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [initClients, refreshBalance]);

  // ── Auto-connect in MiniPay ───────────────────────────────────────────────
  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum?.isMiniPay) {
      connect();
    }
  }, [connect]);

  // ── Approve + joinTable (one UX step) ────────────────────────────────────
  const buyIntoTable = useCallback(async (onChainTableId, amountUSD, contractAddress) => {
    if (!clients.wallet || !address) throw new Error('Wallet not connected');

    const amountWei = parseUnits(String(amountUSD), 18);

    // Step 1: Approve
    const approveTx = await clients.wallet.sendTransaction({
      account: address,
      to:      CUSD_ADDR,
      data:    encodeFunctionData({
        abi:          STABLE_TOKEN_ABI,
        functionName: 'approve',
        args:         [contractAddress, amountWei],
      }),
    });

    await clients.public.waitForTransactionReceipt({ hash: approveTx });

    // Step 2: joinTable
    const joinTx = await clients.wallet.sendTransaction({
      account: address,
      to:      contractAddress,
      data:    encodeFunctionData({
        abi:          POKER_ESCROW_ABI,
        functionName: 'joinTable',
        args:         [BigInt(onChainTableId), amountWei],
      }),
    });

    const receipt = await clients.public.waitForTransactionReceipt({ hash: joinTx });

    // Refresh balance after buy-in
    await refreshBalance(address, clients.public);

    return { hash: joinTx, receipt };
  }, [clients, address, refreshBalance]);

  return {
    address,
    isMiniPay,
    isConnected,
    isLoading,
    cusdBalance,
    error,
    connect,
    refreshBalance: () => refreshBalance(address, clients.public),
    buyIntoTable,
    CUSD_ADDR,
  };
}
