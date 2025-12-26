import { MCPClientConfig } from '@ai-sdk/mcp';
import { JSONSchema7, ToolExecutionOptions } from 'ai';

type McpToolInfo = {
    name: string;
    description?: string;
    title?: string;
    inputSchema: JSONSchema7;
};
type McpToolFunction<Input> = (args: Input) => Promise<unknown>;
type McpToolFunctions = Record<string, McpToolFunction<unknown>>;
type McpToolDefinition = {
    description?: string;
    title?: string;
    inputSchema: unknown;
    execute?: (input: unknown, options: ToolExecutionOptions) => Promise<unknown> | AsyncIterable<unknown> | unknown;
};
type McpToolSet = Record<string, McpToolDefinition>;
declare const createMcpToolFunctions: (toolset: McpToolSet) => Promise<McpToolFunctions>;
declare const listMcpToolsFromToolSet: (toolset: McpToolSet) => Promise<McpToolInfo[]>;
declare const getMcpToolsAsFunctions: (config: MCPClientConfig) => Promise<McpToolFunctions>;
declare const listMcpTools: (config: MCPClientConfig) => Promise<McpToolInfo[]>;

export { type McpToolDefinition, type McpToolFunction, type McpToolFunctions, type McpToolInfo, type McpToolSet, createMcpToolFunctions, getMcpToolsAsFunctions, listMcpTools, listMcpToolsFromToolSet };
