# Privacy Policy

`AvaAgent` is a local-first wallet and swap tool.

## Data handling

- wallet files are stored locally on the user's machine
- private keys are encrypted before storage
- blockchain transactions are sent to the configured RPC endpoint
- swap quotes and swap execution metadata are sent to the configured 0x API endpoint when swap features are used

## What the project does not do

- it does not run a backend that stores wallet secrets
- it does not transmit plaintext private keys to a remote service

## Operator responsibility

Users are responsible for:

- protecting local wallet files
- protecting environment variables and passwords
- reviewing transaction intent before approval
