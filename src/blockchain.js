import { Contract, JsonRpcProvider, formatEther, isAddress, parseEther } from "ethers";

import { ERC20_ABI } from "./abis.js";
import { RpcError, ValidationError } from "./errors.js";

export function createProvider(rpcUrl, chainId) {
  return new JsonRpcProvider(rpcUrl, chainId);
}

export async function getNativeBalance(provider, address) {
  if (!isAddress(address)) {
    throw new ValidationError(`Invalid address: ${address}`);
  }

  const balance = await provider.getBalance(address);
  return {
    wei: balance.toString(),
    avax: formatEther(balance),
  };
}

export async function sendNativeTransfer(wallet, to, amountWei) {
  if (!isAddress(to)) {
    throw new ValidationError(`Invalid recipient address: ${to}`);
  }

  const tx = await wallet.sendTransaction({
    to,
    value: amountWei,
  });

  const receipt = await tx.wait();
  if (receipt?.status !== 1) {
    throw new RpcError(`Native transfer reverted: ${tx.hash}`);
  }

  return {
    hash: tx.hash,
    receipt,
  };
}

export async function sendErc20Transfer(wallet, token, to, amountRaw) {
  if (!isAddress(to)) {
    throw new ValidationError(`Invalid recipient address: ${to}`);
  }

  if (!token || typeof token !== "object" || !isAddress(token.address)) {
    throw new ValidationError(`Invalid token address: ${token?.address}`);
  }

  const contract = new Contract(token.address, ERC20_ABI, wallet);
  try {
    const simulatedResult = await contract.transfer.staticCall(to, amountRaw);
    if (simulatedResult === false) {
      throw new RpcError("ERC20 transfer simulation returned false.");
    }
  } catch (error) {
    if (error instanceof RpcError) {
      throw error;
    }
  }

  const tx = await contract.transfer(to, amountRaw);
  const receipt = await tx.wait();
  if (receipt?.status !== 1) {
    throw new RpcError(`ERC20 transfer reverted: ${tx.hash}`);
  }

  return {
    hash: tx.hash,
    receipt,
  };
}

export function enforceNativeTransferCap(amountWei, maxTransferAvax) {
  if (maxTransferAvax === undefined || maxTransferAvax === null) {
    return;
  }

  const amount = BigInt(amountWei);
  const capWei = parseEther(String(maxTransferAvax));
  if (amount > capWei) {
    throw new ValidationError(
      `Requested transfer exceeds AVAX safety cap (${maxTransferAvax} AVAX).`,
    );
  }
}

export async function assertChain(provider, expectedChainId) {
  const network = await provider.getNetwork();
  const actual = BigInt(network.chainId);
  const expected = BigInt(expectedChainId);
  if (actual !== expected) {
    throw new RpcError(`Connected chain ${actual} does not match expected chain ${expected}.`);
  }
}
