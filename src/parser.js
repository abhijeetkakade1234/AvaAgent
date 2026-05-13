const RESERVED_BALANCE_KEYWORDS = new Set(["for", "to"]);

export function parseAiCommand(input) {
  const text = typeof input === "string" ? input.trim() : "";

  if (!text) {
    return { action: "unknown", raw: text };
  }

  if (/^create(?:\s+new)?\s+wallet$/i.test(text)) {
    return { action: "createWallet" };
  }

  const balanceAddressOnlyMatch = text.match(/^balance\s+for\s+(?<address>0x[a-fA-F0-9]{40})$/i);
  if (balanceAddressOnlyMatch) {
    return {
      action: "balance",
      asset: "AVAX",
      address: balanceAddressOnlyMatch.groups?.address,
    };
  }

  const balanceDirectAddressMatch = text.match(/^balance\s+(?<address>0x[a-fA-F0-9]{40})$/i);
  if (balanceDirectAddressMatch) {
    return {
      action: "balance",
      asset: "AVAX",
      address: balanceDirectAddressMatch.groups?.address,
    };
  }

  if (/^balance$/i.test(text)) {
    return {
      action: "balance",
      asset: "AVAX",
    };
  }

  const balanceAssetMatch = text.match(/^balance\s+(?<asset>[A-Za-z0-9._-]+)$/i);
  if (balanceAssetMatch) {
    const asset = balanceAssetMatch.groups?.asset ?? "AVAX";
    if (RESERVED_BALANCE_KEYWORDS.has(asset.toLowerCase())) {
      return { action: "unknown", raw: text };
    }

    return {
      action: "balance",
      asset,
    };
  }

  const balanceAssetForAddressMatch = text.match(
    /^balance\s+(?<asset>[A-Za-z0-9._-]+)\s+for\s+(?<address>0x[a-fA-F0-9]{40})$/i,
  );
  if (balanceAssetForAddressMatch) {
    return {
      action: "balance",
      asset: balanceAssetForAddressMatch.groups?.asset ?? "AVAX",
      address: balanceAssetForAddressMatch.groups?.address,
    };
  }

  const sendMatch = text.match(
    /^(?:send|transfer)\s+(?<amount>\d*\.?\d+)\s+(?<asset>[A-Za-z0-9._-]+)\s+to\s+(?<to>0x[a-fA-F0-9]{40})$/i,
  );
  if (sendMatch) {
    return {
      action: "send",
      amount: sendMatch.groups.amount,
      asset: sendMatch.groups.asset,
      to: sendMatch.groups.to,
    };
  }

  const quoteSwapMatch = text.match(
    /^(?:quote|price)\s+(?<amount>\d*\.?\d+)\s+(?<sellToken>[A-Za-z0-9._-]+)\s+(?:to|for|into)\s+(?<buyToken>[A-Za-z0-9._-]+)$/i,
  );
  if (quoteSwapMatch) {
    return {
      action: "quoteSwap",
      sellAmount: quoteSwapMatch.groups.amount,
      sellToken: quoteSwapMatch.groups.sellToken,
      buyToken: quoteSwapMatch.groups.buyToken,
    };
  }

  const swapMatch = text.match(
    /^(?:swap|trade)\s+(?<amount>\d*\.?\d+)\s+(?<sellToken>[A-Za-z0-9._-]+)\s+(?:to|for|into)\s+(?<buyToken>[A-Za-z0-9._-]+)$/i,
  );
  if (swapMatch) {
    return {
      action: "swap",
      sellAmount: swapMatch.groups.amount,
      sellToken: swapMatch.groups.sellToken,
      buyToken: swapMatch.groups.buyToken,
    };
  }

  return {
    action: "unknown",
    raw: text,
  };
}
