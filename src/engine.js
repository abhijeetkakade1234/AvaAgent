import { isAddress } from "ethers";

import { assertChain, createProvider, enforceNativeTransferCap, sendErc20Transfer, sendNativeTransfer } from "./blockchain.js";
import { loadConfig } from "./config.js";
import { AuthorizationError, ValidationError } from "./errors.js";
import { parseAiCommand } from "./parser.js";
import { ZeroExSwapService } from "./swap.js";
import { formatTokenAmount, getTokenBalance, parseTokenAmount, resolveToken } from "./tokens.js";
import { createWalletFile, loadWalletFromFile, readWalletRecord } from "./wallet-store.js";

export class AvaAgent {
  constructor(overrides = {}) {
    this.config = loadConfig(overrides);
    this.provider = createProvider(this.config.rpcUrl, this.config.chainId);
    this.swapService = new ZeroExSwapService(this.config, this.provider);
  }

  assertMutationAuthorized(confirmed, actionLabel) {
    if (!this.config.requireConfirmation || confirmed === true) {
      return;
    }

    throw new AuthorizationError(
      `${actionLabel} requires explicit confirmation. Pass confirmed: true or use the CLI with --yes.`,
    );
  }

  async createWallet({ password, confirmed = false }) {
    this.assertMutationAuthorized(confirmed, "Wallet creation");
    return createWalletFile({
      password,
      walletPath: this.config.walletPath,
      chainId: this.config.chainId,
    });
  }

  async getWalletAddress() {
    const record = await readWalletRecord(this.config.walletPath);
    return record.address;
  }

  async unlockWallet({ password }) {
    return loadWalletFromFile({
      password,
      walletPath: this.config.walletPath,
      provider: this.provider,
    });
  }

  async getBalance({ address, asset = "AVAX" } = {}) {
    const resolvedAddress = address ?? (await this.getWalletAddress());
    if (!isAddress(resolvedAddress)) {
      throw new ValidationError(`Invalid address: ${resolvedAddress}`);
    }

    const token = await resolveToken(this.provider, asset);
    const balanceRaw = await getTokenBalance(this.provider, resolvedAddress, token);

    return {
      address: resolvedAddress,
      asset: token.symbol,
      tokenAddress: token.address,
      amountRaw: balanceRaw.toString(),
      amountFormatted: formatTokenAmount(balanceRaw, token),
    };
  }

  async send({ password, to, amount, asset = "AVAX", confirmed = false }) {
    if (!isAddress(to)) {
      throw new ValidationError(`Invalid recipient address: ${to}`);
    }

    this.assertMutationAuthorized(confirmed, "Asset transfer");
    await assertChain(this.provider, this.config.chainId);
    const wallet = await this.unlockWallet({ password });
    const token = await resolveToken(this.provider, asset, { trustedOnly: true });
    const amountRaw = parseTokenAmount(amount, token);

    if (token.isNative) {
      enforceNativeTransferCap(amountRaw, this.config.maxNativeTransferAvax);
      const result = await sendNativeTransfer(wallet, to, amountRaw);
      return {
        kind: "native-transfer",
        asset: token.symbol,
        amount,
        to,
        hash: result.hash,
      };
    }

    const result = await sendErc20Transfer(wallet, token, to, amountRaw);
    return {
      kind: "erc20-transfer",
      asset: token.symbol,
      amount,
      to,
      hash: result.hash,
    };
  }

  async quoteSwap({ sellToken, buyToken, sellAmount, taker }) {
    const takerAddress = taker;
    return this.swapService.getPrice({
      sellToken,
      buyToken,
      sellAmount,
      taker: takerAddress,
    });
  }

  async swap({
    password,
    sellToken,
    buyToken,
    sellAmount,
    slippageBps,
    autoApprove = true,
    confirmed = false,
  }) {
    this.assertMutationAuthorized(confirmed, "Token swap");
    await assertChain(this.provider, this.config.chainId);
    if (this.config.maxSwapSellAmount !== undefined && this.config.maxSwapSellAmount !== null) {
      const resolvedSellToken = await resolveToken(this.provider, sellToken, { trustedOnly: true });
      const requestedAmount = parseTokenAmount(sellAmount, resolvedSellToken);
      const maxAllowedAmount = parseTokenAmount(this.config.maxSwapSellAmount, resolvedSellToken);
      if (requestedAmount > maxAllowedAmount) {
        throw new ValidationError(
          `Requested swap amount exceeds configured cap (${this.config.maxSwapSellAmount}).`,
        );
      }
    }

    const wallet = await this.unlockWallet({ password });
    return this.swapService.executeSwap({
      wallet,
      sellToken,
      buyToken,
      sellAmount,
      slippageBps,
      autoApprove,
    });
  }

  async runAiCommand({ password, input, autoApprove = true, confirmed = false }) {
    const intent = parseAiCommand(input);
    return this.runParsedIntent({ password, intent, autoApprove, confirmed });
  }

  async runParsedIntent({ password, intent, autoApprove = true, confirmed = false }) {
    if (!intent || !intent.action) {
      throw new ValidationError("Parsed AI intent is required.");
    }

    switch (intent.action) {
      case "createWallet":
        return this.createWallet({ password, confirmed });
      case "balance":
        return this.getBalance({
          address: intent.address,
          asset: intent.asset,
        });
      case "send":
        return this.send({
          password,
          to: intent.to,
          amount: intent.amount,
          asset: intent.asset,
          confirmed,
        });
      case "quoteSwap":
        return this.quoteSwap({
          sellToken: intent.sellToken,
          buyToken: intent.buyToken,
          sellAmount: intent.sellAmount,
          taker: intent.taker,
        });
      case "swap":
        return this.swap({
          password,
          sellToken: intent.sellToken,
          buyToken: intent.buyToken,
          sellAmount: intent.sellAmount,
          slippageBps: intent.slippageBps,
          autoApprove,
          confirmed,
        });
      default:
        throw new ValidationError(
          `Unsupported AI command. Supported patterns: create wallet, balance, send, quoteSwap, swap.`,
        );
    }
  }
}
