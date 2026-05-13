# Architecture

## Layers

### 1. Wallet storage

- `src/wallet-store.js`
- creates a random wallet
- encrypts it with a password
- stores `wallet.json` locally

### 2. Chain access

- `src/blockchain.js`
- creates the Avalanche RPC provider
- validates chain ID
- sends native or ERC20 transfers

### 3. Token resolution

- `src/tokens.js`
- resolves known Avalanche token symbols
- falls back to ERC20 metadata for raw contract addresses

### 4. AI parser

- `src/parser.js`
- converts basic natural-language prompts into structured intents

### 5. Execution engine

- `src/engine.js`
- central orchestrator for wallet, transfer, balance, quote, and swap flows
- enforces explicit confirmation before state-changing CLI or SDK execution
- keeps AI parsing separate from the approval gate for wallet mutations
- uses trusted-token checks for value-moving operations instead of arbitrary contract addresses

### 6. DEX routing

- `src/swap.js`
- integrates the 0x AllowanceHolder swap flow on Avalanche
- handles price, quote, approval, and final transaction submission
- rejects missing spender metadata instead of defaulting to an arbitrary approval target
- rejects spender addresses that are not on the configured per-chain allowlist

### 7. Codex control surface

- `src/cli.js`
- `plugins/avaagent/.codex-plugin/plugin.json`
- plugin JSON schemas for request and response contracts

## Request flow

User or Codex -> CLI or SDK -> parser/engine -> explicit approval/policy gate -> wallet + swap services -> Avalanche RPC / 0x API

## Token contract trust boundary

- raw contract addresses are not trusted just because they are valid addresses
- token resolution should prefer ERC20-style metadata and reject clearly malformed contracts
- when optional metadata methods are unavailable, the integration should use a safe fallback instead of silently assuming full compliance
