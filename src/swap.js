import { Contract, MaxUint256 } from "ethers";

import { ERC20_ABI } from "./abis.js";
import { ALLOWED_ZEROX_ALLOWANCE_SPENDERS_BY_CHAIN } from "./constants.js";
import { ConfigError, SwapError } from "./errors.js";
import { formatTokenAmount, parseTokenAmount, resolveToken } from "./tokens.js";

function buildHeaders(apiKey) {
  if (!apiKey) {
    throw new ConfigError(
      "Missing 0x API key. Set AVA_0X_API_KEY or ZEROX_API_KEY before quoting or swapping.",
    );
  }

  return {
    "0x-api-key": apiKey,
    "0x-version": "v2",
    "Content-Type": "application/json",
  };
}

function buildUrl(baseUrl, pathname, params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  }

  return `${baseUrl}${pathname}?${search.toString()}`;
}

async function readJsonResponse(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new SwapError(`0x API request failed with status ${response.status}.`, body);
  }

  return body;
}

function shouldRetryApprovalWithZeroReset(error) {
  const errorText = String(error?.shortMessage ?? error?.message ?? "").toLowerCase();
  return errorText.includes("non-zero") && errorText.includes("allowance");
}

export class ZeroExSwapService {
  constructor(config, provider) {
    this.config = config;
    this.provider = provider;
  }

  async getPrice({ sellToken, buyToken, sellAmount, taker }) {
    const resolvedSellToken = await resolveToken(this.provider, sellToken, { trustedOnly: true });
    const resolvedBuyToken = await resolveToken(this.provider, buyToken, { trustedOnly: true });
    const sellAmountRaw = parseTokenAmount(sellAmount, resolvedSellToken);

    const response = await fetch(
      buildUrl(this.config.zeroExBaseUrl, "/swap/allowance-holder/price", {
        chainId: this.config.chainId,
        sellToken: resolvedSellToken.address,
        buyToken: resolvedBuyToken.address,
        sellAmount: sellAmountRaw.toString(),
        taker,
      }),
      {
        headers: buildHeaders(this.config.zeroExApiKey),
      },
    );

    const quote = await readJsonResponse(response);
    return this.decorateQuote(quote, resolvedSellToken, resolvedBuyToken);
  }

  async getQuote({ sellToken, buyToken, sellAmount, taker, slippageBps }) {
    const resolvedSellToken = await resolveToken(this.provider, sellToken, { trustedOnly: true });
    const resolvedBuyToken = await resolveToken(this.provider, buyToken, { trustedOnly: true });
    const sellAmountRaw = parseTokenAmount(sellAmount, resolvedSellToken);

    const response = await fetch(
      buildUrl(this.config.zeroExBaseUrl, "/swap/allowance-holder/quote", {
        chainId: this.config.chainId,
        sellToken: resolvedSellToken.address,
        buyToken: resolvedBuyToken.address,
        sellAmount: sellAmountRaw.toString(),
        slippageBps: slippageBps ?? this.config.defaultSlippageBps,
        taker,
      }),
      {
        headers: buildHeaders(this.config.zeroExApiKey),
      },
    );

    const quote = await readJsonResponse(response);
    return {
      ...this.decorateQuote(quote, resolvedSellToken, resolvedBuyToken),
      sellAmountRaw,
    };
  }

  decorateQuote(quote, sellToken, buyToken) {
    if (!quote.liquidityAvailable) {
      throw new SwapError("No swap liquidity was returned for this pair and amount.", quote);
    }

    return {
      ...quote,
      sellTokenResolved: sellToken,
      buyTokenResolved: buyToken,
      buyAmountFormatted: formatTokenAmount(BigInt(quote.buyAmount), buyToken),
      minBuyAmountFormatted: quote.minBuyAmount
        ? formatTokenAmount(BigInt(quote.minBuyAmount), buyToken)
        : undefined,
    };
  }

  async ensureAllowance(wallet, sellToken, quote) {
    if (sellToken.isNative) {
      return null;
    }

    const spender = this.getAllowanceSpender(quote);
    const walletAddress = await wallet.getAddress();

    const contract = new Contract(sellToken.address, ERC20_ABI, wallet);
    const currentAllowance = await contract.allowance(walletAddress, spender);

    if (currentAllowance >= quote.sellAmountRaw) {
      return null;
    }

    let approveTx;
    try {
      approveTx = await contract.approve(spender, MaxUint256);
      await approveTx.wait();
    } catch (error) {
      if (!shouldRetryApprovalWithZeroReset(error)) {
        throw error;
      }

      const resetTx = await contract.approve(spender, 0n);
      await resetTx.wait();

      approveTx = await contract.approve(spender, MaxUint256);
      await approveTx.wait();
    }

    return {
      spender,
      hash: approveTx.hash,
    };
  }

  getAllowanceSpender(quote) {
    const spender = quote.issues?.allowance?.spender ?? quote.allowanceTarget;
    if (!spender) {
      throw new SwapError("Swap quote did not include an allowance spender.", quote);
    }

    const allowedSpenders =
      ALLOWED_ZEROX_ALLOWANCE_SPENDERS_BY_CHAIN[this.config.chainId] ?? [];
    if (!allowedSpenders.includes(String(spender).toLowerCase())) {
      throw new SwapError(
        `Swap quote returned an unapproved allowance spender for chain ${this.config.chainId}.`,
        { spender, allowedSpenders },
      );
    }

    return spender;
  }

  async hasSufficientAllowance(wallet, sellToken, quote) {
    if (sellToken.isNative) {
      return true;
    }

    const spender = this.getAllowanceSpender(quote);
    const walletAddress = await wallet.getAddress();
    const contract = new Contract(sellToken.address, ERC20_ABI, wallet);
    const currentAllowance = await contract.allowance(walletAddress, spender);
    return currentAllowance >= quote.sellAmountRaw;
  }

  async executeSwap({ wallet, sellToken, buyToken, sellAmount, slippageBps, autoApprove = true }) {
    const taker = await wallet.getAddress();
    const quote = await this.getQuote({
      sellToken,
      buyToken,
      sellAmount,
      slippageBps,
      taker,
    });

    let approval = null;
    if (!quote.sellTokenResolved.isNative) {
      const hasAllowance = await this.hasSufficientAllowance(
        wallet,
        quote.sellTokenResolved,
        quote,
      );

      if (!hasAllowance && !autoApprove) {
        throw new SwapError(
          "This swap needs token approval. Re-run with auto approval enabled or approve manually first.",
          quote.issues?.allowance,
        );
      }

      if (!hasAllowance) {
        approval = await this.ensureAllowance(wallet, quote.sellTokenResolved, quote);
      }
    }

    const txRequest = {
      to: quote.transaction.to,
      data: quote.transaction.data,
      value: quote.transaction.value ? BigInt(quote.transaction.value) : 0n,
    };

    if (quote.transaction.type !== undefined) {
      txRequest.type = Number(quote.transaction.type);
    }

    if (quote.transaction.gas) {
      txRequest.gasLimit = BigInt(quote.transaction.gas);
    }

    if (
      quote.transaction.gasPrice &&
      !quote.transaction.maxFeePerGas &&
      !quote.transaction.maxPriorityFeePerGas
    ) {
      txRequest.gasPrice = BigInt(quote.transaction.gasPrice);
    }

    if (quote.transaction.maxFeePerGas) {
      txRequest.maxFeePerGas = BigInt(quote.transaction.maxFeePerGas);
    }

    if (quote.transaction.maxPriorityFeePerGas) {
      txRequest.maxPriorityFeePerGas = BigInt(quote.transaction.maxPriorityFeePerGas);
    }

    const swapTx = await wallet.sendTransaction(txRequest);
    const receipt = await swapTx.wait();
    if (receipt?.status !== 1) {
      throw new SwapError(`Swap transaction reverted: ${swapTx.hash}`);
    }

    return {
      approval,
      hash: swapTx.hash,
      receipt,
      quote: {
        buyAmount: quote.buyAmount,
        buyAmountFormatted: quote.buyAmountFormatted,
        minBuyAmount: quote.minBuyAmount,
        minBuyAmountFormatted: quote.minBuyAmountFormatted,
        route: quote.route,
        liquidityAvailable: quote.liquidityAvailable,
      },
    };
  }
}
