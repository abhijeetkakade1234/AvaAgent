# Execution Engine

The engine is implemented in `src/engine.js`.

## Responsibilities

- load configuration
- attach to Avalanche RPC
- create or unlock the local wallet
- normalize token inputs
- dispatch parsed AI intents
- enforce simple safety limits
- call the 0x swap layer for real quotes and swaps

## Main methods

- `createWallet`
- `getWalletAddress`
- `getBalance`
- `send`
- `quoteSwap`
- `swap`
- `runAiCommand`
