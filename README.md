# mcp-to-ts

> A TypeScript interface for MCP Tools

Run any MCP tools from any MCP server in TypeScript.

## Why?

In the era of code-execution based agents, having many LLM tools is becoming less relevant, with the preferred pattern being one code execution based interface to all the tools.

However, with MCP's major influence and prebuilt selection of tools, having a general interface between MCP and toolcalling becomes important.

Unlike other implementations (ex. [Cloudflare Code Mode](https://blog.cloudflare.com/code-mode/)), this library does not require integration with any AI SDK. It is a standalone interface between TypeScript and MCP.

## What?

This package has two main parts:

1. `listMcpTools` to get tools from a MCP Server
2. `getMcpToolsAsFunctions` to run those tools with a typecheck at runtime.

## Usage

Install with your package manager of choice:

```sh
npm i mcp-to-ts
```

And then use:

```ts
import { getMcpToolsAsFunctions, listMcpTools } from "mcp-to-ts";

const clientConfig = {
	transport: {
		type: "http",
		url: "https://your-server.com/mcp",
		headers: { Authorization: "Bearer my-api-key" },
	},
};

const tools = await listMcpTools(clientConfig);
console.log(tools);

const mcpTools = await getMcpToolsAsFunctions(clientConfig);
const output = await mcpTools.someTool({ hello: "world" });
console.log(output);
```

## More Transport Types

Under the hood, we use Vercel AI SDK's MCP implementation. More transport types are available, and you can [reference them here](https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools).

## Notes

- Due to the way that MCP servers work (first requires a call to fetch tool schemas), typechecks only happen at runtime instead of compile-time.
- MCP tools do not carry output schemas, so wrapper return values are `unknown`.
- We used Vercel AI SDK here for simplicity in managing types as well as more standardization when creating clients
