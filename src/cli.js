#!/usr/bin/env node

import { stdin as input, stdout as output } from "node:process";

import { Command } from "commander";

import { AvaAgent } from "./engine.js";
import { ValidationError } from "./errors.js";
import { parseAiCommand } from "./parser.js";

async function readPassword(label = "Wallet password") {
  if (!input.isTTY || typeof input.setRawMode !== "function") {
    throw new ValidationError(
      "Interactive password entry requires a TTY. Use --password or AVA_WALLET_PASSWORD.",
    );
  }

  output.write(`${label}: `);

  return new Promise((resolve, reject) => {
    let password = "";

    function cleanup() {
      input.setRawMode(false);
      input.pause();
      input.off("data", onData);
    }

    function onData(chunk) {
      const value = chunk.toString("utf8");

      for (const character of value) {
        if (character === "\u0003") {
          cleanup();
          reject(new Error("Password entry cancelled."));
          return;
        }

        if (character === "\r" || character === "\n") {
          cleanup();
          output.write("\n");
          resolve(password);
          return;
        }

        if (character === "\b" || character === "\u007f") {
          password = password.slice(0, -1);
          continue;
        }

        password += character;
      }
    }

    input.setRawMode(true);
    input.resume();
    input.on("data", onData);
  });
}

function printResult(result, asJson) {
  if (asJson) {
    console.log(
      JSON.stringify(result, (_, value) => (typeof value === "bigint" ? value.toString() : value), 2),
    );
    return;
  }

  console.dir(result, { depth: null });
}

function requireConfirmation(agent, yesFlag, message) {
  if (!agent.config.requireConfirmation || yesFlag) {
    return;
  }

  throw new Error(`${message} Re-run with --yes or set AVA_REQUIRE_CONFIRMATION=false.`);
}

async function withAgent(options, callback) {
  const agent = new AvaAgent(options);
  return callback(agent);
}

async function resolvePassword(optionPassword, label) {
  if (optionPassword !== undefined) {
    return optionPassword;
  }

  if (process.env.AVA_WALLET_PASSWORD !== undefined) {
    return process.env.AVA_WALLET_PASSWORD;
  }

  return readPassword(label);
}

function isMutatingAiAction(action) {
  return action === "createWallet" || action === "send" || action === "swap";
}

function parseOptionalFiniteNumber(value, label) {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new ValidationError(`${label} must be a finite number.`);
  }

  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 10_000) {
    throw new ValidationError(`${label} must be an integer between 0 and 10000.`);
  }

  return parsed;
}

const program = new Command();

program
  .name("avaagent")
  .description("Local Avalanche wallet SDK + CLI + Codex plugin scaffold")
  .option("--chain-id <id>", "Override the Avalanche chain ID")
  .option("--rpc-url <url>", "Override the Avalanche RPC URL")
  .option("--wallet-path <path>", "Override wallet.json location")
  .option("--json", "Print JSON output", false);

program
  .command("create-wallet")
  .description("Create and encrypt a new local wallet")
  .option("--password <password>", "Wallet encryption password")
  .option("--yes", "Skip mutation confirmation gate", false)
  .action(async (options) => {
    const global = program.opts();
    const password = await resolvePassword(options.password, "New wallet password");
    const result = await withAgent(
      { chainId: global.chainId, rpcUrl: global.rpcUrl, walletPath: global.walletPath },
      (agent) => {
        requireConfirmation(agent, options.yes, "Creating a wallet requires confirmation.");
        return agent.createWallet({ password, confirmed: options.yes });
      },
    );
    printResult(result, global.json);
  });

program
  .command("address")
  .description("Read the address from the local wallet file")
  .action(async () => {
    const global = program.opts();
    const result = await withAgent(
      { chainId: global.chainId, rpcUrl: global.rpcUrl, walletPath: global.walletPath },
      (agent) => agent.getWalletAddress(),
    );
    printResult({ address: result }, global.json);
  });

program
  .command("balance")
  .description("Read the wallet or address balance for AVAX or a token")
  .argument("[asset]", "Token symbol or contract address", "AVAX")
  .option("--address <address>", "Address to inspect instead of the local wallet")
  .action(async (asset, options) => {
    const global = program.opts();
    const result = await withAgent(
      { chainId: global.chainId, rpcUrl: global.rpcUrl, walletPath: global.walletPath },
      (agent) => agent.getBalance({ address: options.address, asset }),
    );
    printResult(result, global.json);
  });

program
  .command("send")
  .description("Send AVAX or an ERC20 token from the local wallet")
  .requiredOption("--to <address>", "Recipient address")
  .requiredOption("--amount <amount>", "Amount in display units")
  .option("--asset <asset>", "Token symbol or contract address", "AVAX")
  .option("--password <password>", "Wallet password")
  .option("--yes", "Skip mutation confirmation gate", false)
  .action(async (options) => {
    const global = program.opts();
    const result = await withAgent(
      { chainId: global.chainId, rpcUrl: global.rpcUrl, walletPath: global.walletPath },
      async (agent) => {
        requireConfirmation(agent, options.yes, "Sending funds requires confirmation.");
        const password = await resolvePassword(options.password, "Wallet password");
        return agent.send({
          password,
          to: options.to,
          amount: options.amount,
          asset: options.asset,
          confirmed: options.yes,
        });
      },
    );
    printResult(result, global.json);
  });

program
  .command("quote-swap")
  .description("Get a real Avalanche swap price using 0x Swap API")
  .requiredOption("--sell-token <token>", "Sell token symbol or address")
  .requiredOption("--buy-token <token>", "Buy token symbol or address")
  .requiredOption("--sell-amount <amount>", "Sell amount in display units")
  .option("--taker <address>", "Explicit taker address")
  .action(async (options) => {
    const global = program.opts();
    const result = await withAgent(
      { chainId: global.chainId, rpcUrl: global.rpcUrl, walletPath: global.walletPath },
      (agent) =>
        agent.quoteSwap({
          sellToken: options.sellToken,
          buyToken: options.buyToken,
          sellAmount: options.sellAmount,
          taker: options.taker,
        }),
    );
    printResult(result, global.json);
  });

program
  .command("swap")
  .description("Execute a real Avalanche swap using 0x Swap API")
  .requiredOption("--sell-token <token>", "Sell token symbol or address")
  .requiredOption("--buy-token <token>", "Buy token symbol or address")
  .requiredOption("--sell-amount <amount>", "Sell amount in display units")
  .option("--slippage-bps <bps>", "Slippage in basis points")
  .option("--password <password>", "Wallet password")
  .option("--yes", "Skip mutation confirmation gate", false)
  .option("--no-auto-approve", "Do not auto-approve ERC20 allowance")
  .action(async (options) => {
    const global = program.opts();
    const result = await withAgent(
      { chainId: global.chainId, rpcUrl: global.rpcUrl, walletPath: global.walletPath },
      async (agent) => {
        requireConfirmation(agent, options.yes, "Executing a swap requires confirmation.");
        const password = await resolvePassword(options.password, "Wallet password");
        const slippageBps = parseOptionalFiniteNumber(options.slippageBps, "--slippage-bps");
        return agent.swap({
          password,
          sellToken: options.sellToken,
          buyToken: options.buyToken,
          sellAmount: options.sellAmount,
          slippageBps,
          autoApprove: options.autoApprove,
          confirmed: options.yes,
        });
      },
    );
    printResult(result, global.json);
  });

program
  .command("ai")
  .description("Parse a natural-language command and execute it")
  .argument("<prompt>", "AI command text")
  .option("--password <password>", "Wallet password for wallet mutations")
  .option("--yes", "Skip mutation confirmation gate", false)
  .action(async (prompt, options) => {
    const global = program.opts();
    const result = await withAgent(
      { chainId: global.chainId, rpcUrl: global.rpcUrl, walletPath: global.walletPath },
      async (agent) => {
        const intent = parseAiCommand(prompt);
        if (intent.action === "unknown") {
          throw new ValidationError(
            "Unsupported AI command. Use a supported prompt shape or the explicit CLI commands.",
          );
        }

        requireConfirmation(agent, options.yes, "AI command execution requires confirmation.");

        const needsMutationApproval = isMutatingAiAction(intent.action);

        const password = needsMutationApproval
          ? await resolvePassword(options.password, "Wallet password")
          : undefined;

        return agent.runParsedIntent({
          password,
          intent,
          autoApprove: options.yes,
          confirmed: options.yes,
        });
      },
    );
    printResult(result, global.json);
  });

program.parseAsync(process.argv).catch((error) => {
  const normalizedError =
    error instanceof Error
      ? error
      : new Error(String(error ?? "Unknown error"));
  const message = normalizedError?.details
    ? { error: normalizedError.message, details: normalizedError.details }
    : { error: normalizedError.message };
  console.error(JSON.stringify(message, null, 2));
  process.exitCode = 1;
});
