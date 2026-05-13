import process from "node:process";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["./plugins/avaagent/mcp/server.js"],
  cwd: process.cwd(),
  stderr: "pipe",
});

const client = new Client(
  {
    name: "avaagent-mcp-smoke",
    version: "0.1.0",
  },
  {
    capabilities: {},
  },
);

await client.connect(transport);

const tools = await client.listTools();
const toolNames = tools.tools.map((tool) => tool.name).sort();
const expectedToolNames = [
  "avaagent_create_wallet",
  "avaagent_get_address",
  "avaagent_get_balance",
  "avaagent_quote_swap",
  "avaagent_send",
  "avaagent_swap",
];

for (const expectedToolName of expectedToolNames) {
  if (!toolNames.includes(expectedToolName)) {
    throw new Error(`Missing MCP tool: ${expectedToolName}`);
  }
}

await client.close();
