import {
  Contract,
  decodeBytes32String,
  formatEther,
  formatUnits,
  isAddress,
  parseEther,
  parseUnits,
} from "ethers";

import { ERC20_ABI } from "./abis.js";
import {
  KNOWN_AVALANCHE_TOKEN_ADDRESSES,
  KNOWN_AVALANCHE_TOKENS,
  NATIVE_TOKEN_PLACEHOLDER,
} from "./constants.js";
import { ValidationError } from "./errors.js";

function normalizeTokenKey(value) {
  return String(value).trim().toUpperCase();
}

export function isNativeTokenInput(value) {
  const normalized = normalizeTokenKey(value);
  return normalized === "AVAX" || normalized === normalizeTokenKey(NATIVE_TOKEN_PLACEHOLDER);
}

export async function resolveToken(provider, tokenInput, options = {}) {
  if (!tokenInput) {
    throw new ValidationError("Token is required.");
  }

  const { trustedOnly = false } = options;

  const normalizedInput = String(tokenInput).trim();

  if (isNativeTokenInput(normalizedInput)) {
    return KNOWN_AVALANCHE_TOKENS.AVAX;
  }

  const known = KNOWN_AVALANCHE_TOKENS[normalizeTokenKey(normalizedInput)];
  if (known) {
    return known;
  }

  if (!isAddress(normalizedInput)) {
    throw new ValidationError(`Unknown token symbol or address: ${normalizedInput}`);
  }

  if (trustedOnly && !KNOWN_AVALANCHE_TOKEN_ADDRESSES.has(normalizedInput.toLowerCase())) {
    throw new ValidationError(
      `Untrusted token address: ${normalizedInput}. Value-moving operations only allow known token addresses.`,
    );
  }

  const contract = new Contract(normalizedInput, ERC20_ABI, provider);
  const [symbol, decimals] = await Promise.all([
    readTokenSymbol(provider, normalizedInput),
    readTokenDecimals(contract),
  ]);
  const normalizedDecimals = Number(decimals);
  if (!Number.isInteger(normalizedDecimals) || normalizedDecimals < 0 || normalizedDecimals > 255) {
    throw new ValidationError(`Invalid token decimals returned for ${normalizedInput}.`);
  }

  return {
    symbol,
    address: normalizedInput,
    decimals: normalizedDecimals,
    isNative: false,
  };
}

async function readTokenSymbol(provider, tokenAddress) {
  const stringAbiContract = new Contract(tokenAddress, ["function symbol() view returns (string)"], provider);
  try {
    return await stringAbiContract.symbol();
  } catch {
    try {
      const raw = await provider.call({
        to: tokenAddress,
        data: "0x95d89b41",
      });
      return decodeBytes32String(raw);
    } catch {
      return tokenAddress.slice(0, 10);
    }
  }
}

async function readTokenDecimals(contract) {
  try {
    return await contract.decimals();
  } catch {
    throw new ValidationError("Token contract does not expose a usable decimals() value.");
  }
}

export function parseTokenAmount(amount, token) {
  if (amount === undefined || amount === null || amount === "") {
    throw new ValidationError("Amount is required.");
  }

  return token.isNative
    ? parseEther(String(amount))
    : parseUnits(String(amount), token.decimals);
}

export function formatTokenAmount(amount, token) {
  return token.isNative
    ? formatEther(amount)
    : formatUnits(amount, token.decimals);
}

export async function getTokenBalance(provider, address, token) {
  if (token.isNative) {
    return provider.getBalance(address);
  }

  const contract = new Contract(token.address, ERC20_ABI, provider);
  return contract.balanceOf(address);
}
