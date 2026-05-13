import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

import { AVALANCHE_MAINNET } from "./constants.js";
import { ConfigError } from "./errors.js";

function envBoolean(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  throw new ConfigError("AVA_REQUIRE_CONFIRMATION must be a valid boolean value.");
}

function parseOptionalBoolean(value, label) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  throw new ConfigError(`${label} must be a valid boolean value.`);
}

function parseOptionalNumber(value, label) {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new ConfigError(`${label} must be a finite number.`);
  }

  return parsed;
}

function parseNonNegativeNumber(value, label, fallback = undefined) {
  const parsed =
    fallback === undefined
      ? parseOptionalNumber(value, label)
      : parseRequiredNumber(value, label, fallback);
  if (parsed === undefined) {
    return undefined;
  }

  if (parsed < 0) {
    throw new ConfigError(`${label} must be greater than or equal to 0.`);
  }

  return parsed;
}

function parseRequiredNumber(value, label, fallback) {
  const candidate = coerceBlankToUndefined(value) ?? fallback;
  const parsed = parseOptionalNumber(candidate, label);
  if (parsed === undefined) {
    throw new ConfigError(`${label} is required.`);
  }

  return parsed;
}

function parsePositiveInteger(value, label, fallback) {
  const parsed = parseRequiredNumber(value, label, fallback);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ConfigError(`${label} must be a positive integer.`);
  }

  return parsed;
}

function parseBps(value, label, fallback) {
  const parsed = parseRequiredNumber(value, label, fallback);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 10_000) {
    throw new ConfigError(`${label} must be between 0 and 10000 basis points.`);
  }

  return parsed;
}

function coerceBlankToUndefined(value) {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }

  return value;
}

export function loadConfig(overrides = {}) {
  const cwd = overrides.cwd ?? process.cwd();
  const envFilePath = path.resolve(cwd, ".env");
  const fileEnv = fs.existsSync(envFilePath)
    ? dotenv.parse(fs.readFileSync(envFilePath, "utf8"))
    : {};
  const resolveEnvValue = (key) =>
    coerceBlankToUndefined(process.env[key]) ?? coerceBlankToUndefined(fileEnv[key]);
  const rawMaxNativeTransferAvax = coerceBlankToUndefined(
    overrides.maxNativeTransferAvax ?? resolveEnvValue("AVA_MAX_NATIVE_TRANSFER_AVAX"),
  );
  const rawMaxSwapSellAmount = coerceBlankToUndefined(
    overrides.maxSwapSellAmount ?? resolveEnvValue("AVA_MAX_SWAP_SELL_AMOUNT"),
  );
  const rawWalletPath = coerceBlankToUndefined(
    overrides.walletPath ?? resolveEnvValue("AVA_WALLET_FILE"),
  );
  const rawRpcUrl = coerceBlankToUndefined(overrides.rpcUrl ?? resolveEnvValue("AVA_RPC_URL"));
  const zeroExBaseUrl =
    coerceBlankToUndefined(overrides.zeroExBaseUrl) ??
    resolveEnvValue("AVA_0X_BASE_URL") ??
    "https://api.0x.org";
  const allowUnsafeZeroExBaseUrl = parseOptionalBoolean(
    resolveEnvValue("AVA_ALLOW_UNSAFE_0X_BASE_URL"),
    "AVA_ALLOW_UNSAFE_0X_BASE_URL",
  );

  if (zeroExBaseUrl !== "https://api.0x.org" && allowUnsafeZeroExBaseUrl !== true) {
    throw new ConfigError(
      "Non-default 0x base URLs are blocked by default. Set AVA_ALLOW_UNSAFE_0X_BASE_URL=true only if you trust the override.",
    );
  }

  return {
    chainId: parsePositiveInteger(
      overrides.chainId,
      "AVA_CHAIN_ID",
      resolveEnvValue("AVA_CHAIN_ID") ?? AVALANCHE_MAINNET.chainId,
    ),
    rpcUrl: rawRpcUrl ?? AVALANCHE_MAINNET.rpcUrl,
    walletPath: path.resolve(
      cwd,
      rawWalletPath ?? "./wallet.json",
    ),
    zeroExApiKey:
      coerceBlankToUndefined(overrides.zeroExApiKey) ??
      resolveEnvValue("AVA_0X_API_KEY") ??
      resolveEnvValue("ZEROX_API_KEY"),
    zeroExBaseUrl,
    defaultSlippageBps: parseBps(
      overrides.defaultSlippageBps,
      "AVA_DEFAULT_SLIPPAGE_BPS",
      resolveEnvValue("AVA_DEFAULT_SLIPPAGE_BPS") ?? 100,
    ),
    requireConfirmation: envBoolean(
      overrides.requireConfirmation ?? resolveEnvValue("AVA_REQUIRE_CONFIRMATION"),
      true,
    ),
    maxNativeTransferAvax: parseNonNegativeNumber(
      rawMaxNativeTransferAvax ?? 5,
      "AVA_MAX_NATIVE_TRANSFER_AVAX",
    ),
    maxSwapSellAmount: parseNonNegativeNumber(
      rawMaxSwapSellAmount,
      "AVA_MAX_SWAP_SELL_AMOUNT",
    ),
  };
}
