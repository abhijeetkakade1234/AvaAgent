# AI Parser

The parser is intentionally rule-based for now.

## Supported prompts

- `create wallet`
- `balance`
- `balance USDC`
- `send 0.5 AVAX to 0x...`
- `quote 1 AVAX to USDC`
- `swap 1 AVAX to USDC`

## Output shape

Examples:

```json
{
  "action": "send",
  "amount": "0.5",
  "asset": "AVAX",
  "to": "0xabc..."
}
```

```json
{
  "action": "swap",
  "sellAmount": "1",
  "sellToken": "AVAX",
  "buyToken": "USDC"
}
```

```json
{
  "action": "quoteSwap",
  "sellAmount": "1",
  "sellToken": "AVAX",
  "buyToken": "USDC"
}
```
