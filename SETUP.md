# Setup

## 1. Install dependencies

```bash
npm install
```

## 2. Create env file

```powershell
Copy-Item .env.example .env
```

Then set your 0x API key and any local overrides.

## 3. Create a wallet

```bash
avaagent create-wallet
```

## 4. Check the address and balance

```bash
avaagent address --json
avaagent balance AVAX --json
```

## 5. Quote a real swap

```bash
avaagent quote-swap --sell-token AVAX --buy-token USDC --sell-amount 0.1
```
