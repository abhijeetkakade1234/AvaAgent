export const AVALANCHE_MAINNET = {
  chainId: 43114,
  name: "Avalanche C-Chain",
  rpcUrl: "https://api.avax.network/ext/bc/C/rpc",
};

export const NATIVE_TOKEN_PLACEHOLDER =
  "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

export const ZEROX_ALLOWANCE_HOLDER_CANCUN =
  "0x0000000000001fF3684f28c67538d4D072C22734";

export const ALLOWED_ZEROX_ALLOWANCE_SPENDERS_BY_CHAIN = {
  43114: [ZEROX_ALLOWANCE_HOLDER_CANCUN.toLowerCase()],
};

export const KNOWN_AVALANCHE_TOKENS = {
  AVAX: {
    symbol: "AVAX",
    address: NATIVE_TOKEN_PLACEHOLDER,
    decimals: 18,
    isNative: true,
  },
  WAVAX: {
    symbol: "WAVAX",
    address: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
    decimals: 18,
    isNative: false,
  },
  USDC: {
    symbol: "USDC",
    address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
    decimals: 6,
    isNative: false,
  },
  USDT: {
    symbol: "USDT",
    address: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7",
    decimals: 6,
    isNative: false,
  },
  WETH: {
    symbol: "WETH",
    address: "0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB",
    decimals: 18,
    isNative: false,
  },
  BTCB: {
    symbol: "BTCB",
    address: "0x152b9d0FdC40C096757F570A51E494bd4B943E50",
    decimals: 8,
    isNative: false,
  },
};

export const KNOWN_AVALANCHE_TOKEN_ADDRESSES = new Set(
  Object.values(KNOWN_AVALANCHE_TOKENS)
    .filter((token) => !token.isNative)
    .map((token) => token.address.toLowerCase()),
);
