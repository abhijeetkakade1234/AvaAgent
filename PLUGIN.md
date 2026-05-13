# Codex Plugin

This repo now contains a repo-local callable Codex plugin for `AvaAgent`.

## Files

- manifest: `plugins/avaagent/.codex-plugin/plugin.json`
- MCP registration: `plugins/avaagent/.mcp.json`
- MCP server: `plugins/avaagent/mcp/server.js`
- skill: `plugins/avaagent/skills/avaagent-control/SKILL.md`
- action schema: `plugins/avaagent/schemas/action.schema.json`
- response schema: `plugins/avaagent/schemas/response.schema.json`
- marketplace entry: `.agents/plugins/marketplace.json`

## Purpose

Give Codex a deterministic, local control surface for:

- wallet creation
- address lookup
- token balances
- AVAX or ERC20 sends
- real DEX quote retrieval
- real swap execution
- natural-language wallet commands

## Safety contract

- state-changing actions must require explicit user confirmation before `--yes` is added
- SDK callers must pass an explicit confirmation signal for state-changing actions; the safety boundary is not CLI-only
- recipient, chain, amount, and slippage inputs must be validated before execution
- swap spender contracts must be allowlisted per chain before any approval transaction is sent
- safe defaults should remain in place for confirmation, caps, and unattended execution rules

## Integration style

The plugin now exposes a real MCP stdio server. That server is intentionally thin and routes through the local `avaagent` CLI so one code path is shared between humans and Codex.

When the target network is not Avalanche mainnet, the CLI contract must pass both `--chain-id` and `--rpc-url` together. For Fuji this means `--chain-id 43113` plus the Fuji C-Chain RPC URL.

## Current state

- plugin manifest exists
- plugin MCP registration exists
- plugin MCP server exists
- marketplace entry exists
- action and response schemas exist
- Codex can call wallet and swap tools through MCP

The current server wraps the CLI contract. A later optimization would be to swap the server internals from CLI execution to direct SDK calls without changing the exposed tools.
