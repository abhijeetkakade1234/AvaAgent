# Wallet

## Module

`src/wallet-store.js`

## Responsibilities

- create a random wallet
- encrypt it with a password
- store the encrypted payload locally
- decrypt it only when a mutating action needs signing

## File format

The local wallet file stores:

- `version`
- `chainId`
- `address`
- `encryptedJson`
- `createdAt`

## Related commands

- `avaagent create-wallet`
- `avaagent address`
