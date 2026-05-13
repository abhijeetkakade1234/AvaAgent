#!/usr/bin/env node

import { access } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod/v4";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const REPO_CLI_PATH = path.join(REPO_ROOT, "src", "cli.js");

const server = new McpServer({
  name: "avaagent",
  version: "0.1.0",
});

const baseInputSchema = {
  workingDirectory: z
    .string()
    .min(1)
    .optional()
    .describe("Optional workspace directory used for .env loading and wallet path validation."),
  chainId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Optional Avalanche chain ID override such as 43114 for mainnet or 43113 for Fuji."),
  rpcUrl: z
    .string()
    .url()
    .optional()
    .describe("Optional RPC URL override."),
  walletPath: z
    .string()
    .min(1)
    .optional()
    .describe("Optional wallet file path. Use an absolute path when possible."),
  zeroExApiKey: z
    .string()
    .min(1)
    .optional()
    .describe("Optional 0x API key override for quote and swap calls."),
};

const addressOutputSchema = {
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
};

const balanceOutputSchema = {
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  asset: z.string(),
  tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$|^0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE$/),
  amountRaw: z.string(),
  amountFormatted: z.string(),
};

const sendOutputSchema = {
  kind: z.enum(["native-transfer", "erc20-transfer"]),
  asset: z.string(),
  amount: z.string(),
  to: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  hash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
};

const quoteOutputSchema = {
  liquidityAvailable: z.boolean(),
  buyAmount: z.string(),
  buyAmountFormatted: z.string(),
  minBuyAmount: z.string().optional(),
  minBuyAmountFormatted: z.string().optional(),
  price: z.string().optional(),
  guaranteedPrice: z.string().optional(),
  sellTokenResolved: z.object({
    symbol: z.string(),
    address: z.string(),
    decimals: z.number().int(),
    isNative: z.boolean(),
  }),
  buyTokenResolved: z.object({
    symbol: z.string(),
    address: z.string(),
    decimals: z.number().int(),
    isNative: z.boolean(),
  }),
};

const swapOutputSchema = {
  approval: z
    .object({
      spender: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      hash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
    })
    .nullable(),
  hash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  quote: z.object({
    buyAmount: z.string(),
    buyAmountFormatted: z.string(),
    minBuyAmount: z.string().optional(),
    minBuyAmountFormatted: z.string().optional(),
    route: z.record(z.string(), z.unknown()).optional(),
    liquidityAvailable: z.boolean(),
  }),
};

function textResult(payload) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2),
      },
    ],
    structuredContent: payload,
  };
}

function errorResult(error) {
  const payload = normalizeErrorPayload(error);
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2),
      },
    ],
    structuredContent: payload,
    isError: true,
  };
}

function normalizeErrorPayload(error) {
  if (!error) {
    return { error: "Unknown error." };
  }

  if (typeof error === "object" && error !== null && "error" in error) {
    return {
      error: String(error.error),
      ...(Object.prototype.hasOwnProperty.call(error, "details")
        ? { details: error.details }
        : {}),
    };
  }

  if (error instanceof Error) {
    return { error: error.message };
  }

  return { error: String(error) };
}

async function withToolResult(operation) {
  try {
    const payload = await operation();
    return textResult(payload);
  } catch (error) {
    return errorResult(error);
  }
}

async function fileExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function resolveCliRuntime(workingDirectory) {
  const explicitCliPath = process.env.AVAAGENT_CLI_PATH;
  if (explicitCliPath) {
    return normalizeExecutable(explicitCliPath, workingDirectory);
  }

  if (await fileExists(REPO_CLI_PATH)) {
    return {
      command: process.execPath,
      args: [REPO_CLI_PATH],
      cwd: workingDirectory ?? REPO_ROOT,
    };
  }

  return {
    command: process.platform === "win32" ? "avaagent.cmd" : "avaagent",
    args: [],
    cwd: workingDirectory ?? process.cwd(),
  };
}

function normalizeExecutable(executablePath, workingDirectory) {
  const normalizedPath = path.resolve(executablePath);
  if (normalizedPath.toLowerCase().endsWith(".js")) {
    return {
      command: process.execPath,
      args: [normalizedPath],
      cwd: workingDirectory ?? path.dirname(normalizedPath),
    };
  }

  return {
    command: normalizedPath,
    args: [],
    cwd: workingDirectory ?? path.dirname(normalizedPath),
  };
}

function buildCliArgs({
  chainId,
  rpcUrl,
  walletPath,
  commandArgs,
}) {
  const args = [];

  if (chainId !== undefined) {
    args.push("--chain-id", String(chainId));
  }

  if (rpcUrl) {
    args.push("--rpc-url", rpcUrl);
  }

  if (walletPath) {
    args.push("--wallet-path", walletPath);
  }

  args.push("--json", ...commandArgs);
  return args;
}

async function runAvaAgent({
  workingDirectory,
  chainId,
  rpcUrl,
  walletPath,
  zeroExApiKey,
  commandArgs,
}) {
  const runtime = await resolveCliRuntime(workingDirectory);
  const args = [...runtime.args, ...buildCliArgs({ chainId, rpcUrl, walletPath, commandArgs })];
  const env = {
    ...process.env,
    ...(zeroExApiKey ? { AVA_0X_API_KEY: zeroExApiKey } : {}),
  };

  return new Promise((resolve, reject) => {
    const child = spawn(runtime.command, args, {
      cwd: runtime.cwd,
      env,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        try {
          resolve(parseJsonOutput(stdout));
        } catch (error) {
          reject(error);
        }
        return;
      }

      reject(parseErrorOutput(stderr, stdout, code));
    });
  });
}

function parseJsonOutput(rawOutput) {
  const trimmed = rawOutput.trim();
  if (!trimmed) {
    throw new Error("AvaAgent CLI returned no output.");
  }

  return JSON.parse(trimmed);
}

function parseErrorOutput(stderr, stdout, code) {
  const raw = [stderr, stdout].filter(Boolean).join("\n").trim();
  if (!raw) {
    return { error: `AvaAgent CLI failed with exit code ${code}.` };
  }

  try {
    return JSON.parse(raw);
  } catch {
    return { error: raw };
  }
}

function requireConfirmed(confirmed, actionLabel) {
  if (confirmed === true) {
    return;
  }

  throw new Error(`${actionLabel} requires confirmed: true.`);
}

server.registerTool(
  "avaagent_get_address",
  {
    title: "Get AvaAgent Wallet Address",
    description: "Read the address from the configured local AvaAgent wallet file.",
    inputSchema: {
      ...baseInputSchema,
    },
    outputSchema: addressOutputSchema,
    annotations: {
      title: "Get wallet address",
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  async (args) =>
    withToolResult(() =>
      runAvaAgent({
        workingDirectory: args.workingDirectory,
        chainId: args.chainId,
        rpcUrl: args.rpcUrl,
        walletPath: args.walletPath,
        commandArgs: ["address"],
      }),
    ),
);

server.registerTool(
  "avaagent_get_balance",
  {
    title: "Get AvaAgent Balance",
    description: "Read an AVAX or token balance for the local wallet or a specific address.",
    inputSchema: {
      ...baseInputSchema,
      asset: z.string().min(1).default("AVAX").describe("Token symbol or address. Defaults to AVAX."),
      address: z
        .string()
        .regex(/^0x[a-fA-F0-9]{40}$/)
        .optional()
        .describe("Optional wallet address to inspect instead of the local wallet."),
    },
    outputSchema: balanceOutputSchema,
    annotations: {
      title: "Get balance",
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  async (args) =>
    withToolResult(() =>
      runAvaAgent({
        workingDirectory: args.workingDirectory,
        chainId: args.chainId,
        rpcUrl: args.rpcUrl,
        walletPath: args.walletPath,
        commandArgs: [
          "balance",
          args.asset,
          ...(args.address ? ["--address", args.address] : []),
        ],
      }),
    ),
);

server.registerTool(
  "avaagent_create_wallet",
  {
    title: "Create AvaAgent Wallet",
    description: "Create and encrypt a new local AvaAgent wallet file.",
    inputSchema: {
      ...baseInputSchema,
      password: z.string().min(1).describe("Encryption password for the new wallet."),
      confirmed: z.boolean().describe("Must be true before creating a wallet."),
    },
    outputSchema: {
      address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      walletPath: z.string(),
    },
    annotations: {
      title: "Create wallet",
      destructiveHint: true,
      readOnlyHint: false,
      idempotentHint: false,
    },
  },
  async (args) =>
    withToolResult(async () => {
      requireConfirmed(args.confirmed, "Wallet creation");
      return runAvaAgent({
        workingDirectory: args.workingDirectory,
        chainId: args.chainId,
        rpcUrl: args.rpcUrl,
        walletPath: args.walletPath,
        commandArgs: ["create-wallet", "--password", args.password, "--yes"],
      });
    }),
);

server.registerTool(
  "avaagent_send",
  {
    title: "Send With AvaAgent",
    description: "Send AVAX or a trusted token from the local AvaAgent wallet.",
    inputSchema: {
      ...baseInputSchema,
      to: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Recipient address."),
      amount: z.string().min(1).describe("Amount in display units."),
      asset: z.string().min(1).default("AVAX").describe("Token symbol or address."),
      password: z.string().min(1).describe("Wallet password."),
      confirmed: z.boolean().describe("Must be true before sending funds."),
    },
    outputSchema: sendOutputSchema,
    annotations: {
      title: "Send asset",
      destructiveHint: true,
      readOnlyHint: false,
      idempotentHint: false,
    },
  },
  async (args) =>
    withToolResult(async () => {
      requireConfirmed(args.confirmed, "Asset transfer");
      return runAvaAgent({
        workingDirectory: args.workingDirectory,
        chainId: args.chainId,
        rpcUrl: args.rpcUrl,
        walletPath: args.walletPath,
        commandArgs: [
          "send",
          "--to",
          args.to,
          "--amount",
          args.amount,
          "--asset",
          args.asset,
          "--password",
          args.password,
          "--yes",
        ],
      });
    }),
);

server.registerTool(
  "avaagent_quote_swap",
  {
    title: "Quote AvaAgent Swap",
    description: "Fetch a real Avalanche swap quote from 0x through AvaAgent.",
    inputSchema: {
      ...baseInputSchema,
      sellToken: z.string().min(1).describe("Trusted sell token symbol or address."),
      buyToken: z.string().min(1).describe("Trusted buy token symbol or address."),
      sellAmount: z.string().min(1).describe("Sell amount in display units."),
      taker: z
        .string()
        .regex(/^0x[a-fA-F0-9]{40}$/)
        .optional()
        .describe("Optional taker address."),
    },
    outputSchema: quoteOutputSchema,
    annotations: {
      title: "Quote swap",
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  async (args) =>
    withToolResult(() =>
      runAvaAgent({
        workingDirectory: args.workingDirectory,
        chainId: args.chainId,
        rpcUrl: args.rpcUrl,
        walletPath: args.walletPath,
        zeroExApiKey: args.zeroExApiKey,
        commandArgs: [
          "quote-swap",
          "--sell-token",
          args.sellToken,
          "--buy-token",
          args.buyToken,
          "--sell-amount",
          args.sellAmount,
          ...(args.taker ? ["--taker", args.taker] : []),
        ],
      }),
    ),
);

server.registerTool(
  "avaagent_swap",
  {
    title: "Execute AvaAgent Swap",
    description: "Execute a real Avalanche swap from the local AvaAgent wallet.",
    inputSchema: {
      ...baseInputSchema,
      sellToken: z.string().min(1).describe("Trusted sell token symbol or address."),
      buyToken: z.string().min(1).describe("Trusted buy token symbol or address."),
      sellAmount: z.string().min(1).describe("Sell amount in display units."),
      slippageBps: z
        .number()
        .int()
        .min(0)
        .max(10000)
        .optional()
        .describe("Optional slippage override in basis points."),
      password: z.string().min(1).describe("Wallet password."),
      autoApprove: z
        .boolean()
        .default(true)
        .describe("When false, fail if token approval would be needed."),
      confirmed: z.boolean().describe("Must be true before executing a swap."),
    },
    outputSchema: swapOutputSchema,
    annotations: {
      title: "Execute swap",
      destructiveHint: true,
      readOnlyHint: false,
      idempotentHint: false,
    },
  },
  async (args) =>
    withToolResult(async () => {
      requireConfirmed(args.confirmed, "Token swap");
      return runAvaAgent({
        workingDirectory: args.workingDirectory,
        chainId: args.chainId,
        rpcUrl: args.rpcUrl,
        walletPath: args.walletPath,
        zeroExApiKey: args.zeroExApiKey,
        commandArgs: [
          "swap",
          "--sell-token",
          args.sellToken,
          "--buy-token",
          args.buyToken,
          "--sell-amount",
          args.sellAmount,
          ...(args.slippageBps !== undefined
            ? ["--slippage-bps", String(args.slippageBps)]
            : []),
          ...(args.autoApprove ? [] : ["--no-auto-approve"]),
          "--password",
          args.password,
          "--yes",
        ],
      });
    }),
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("AvaAgent MCP server failed to start:", error);
  process.exit(1);
});
