import {
	jsonSchema,
	type Tool,
	type ToolExecuteFunction,
	type ToolExecutionOptions,
	type ToolSet,
	TypeValidationError,
} from "ai"
import { describe, expect, test, vi } from "vitest"
import {
	createMcpToolFunctions,
	listMcpToolsFromToolSet,
} from "../src/index.js"

describe("mcp-to-ts", () => {
	test("createMcpToolFunctions validates input before execution", async () => {
		const execute: ToolExecuteFunction<{ name: string }, string> = vi.fn(
			async (input: { name: string }, options: ToolExecutionOptions) => {
				if (options.toolCallId.length === 0) {
					throw new Error("Missing tool call id")
				}
				return `hello ${input.name}`
			},
		)
		const tool: Tool<{ name: string }, string> & {
			execute: ToolExecuteFunction<{ name: string }, string>
		} = {
			description: "Greets a name",
			inputSchema: jsonSchema({
				type: "object",
				properties: {
					name: { type: "string" },
				},
				required: ["name"],
				additionalProperties: false,
			}),
			execute,
		}
		const toolset: ToolSet = { greet: tool }

		const tools = await createMcpToolFunctions(toolset)
		const result = await tools.greet({ name: "bob" })

		expect(result).toBe("hello world")
		expect(execute).toHaveBeenCalledTimes(1)

		await expect(tools.greet({ name: 123 })).rejects.toThrow(
			TypeValidationError,
		)
	})

	test("createMcpToolFunctions throws when execute is missing", async () => {
		const toolset = {
			noop: {
				description: "Noop",
				inputSchema: jsonSchema({
					type: "object",
					properties: {},
					additionalProperties: false,
				}),
			},
		}

		const tools = await createMcpToolFunctions(toolset)
		await expect(tools.noop({})).rejects.toThrow("execute function")
	})

	test("listMcpToolsFromToolSet returns tool metadata and schemas", async () => {
		const toolset = {
			calc: {
				description: "Adds values",
				title: "Calculator",
				inputSchema: jsonSchema({
					type: "object",
					properties: {
						value: { type: "number" },
					},
					required: ["value"],
					additionalProperties: false,
				}),
				execute: async () => ({ ok: true }),
			},
		}

		const tools = await listMcpToolsFromToolSet(toolset)

		expect(tools).toHaveLength(1)
		expect(tools[0]?.name).toBe("calc")
		expect(tools[0]?.description).toBe("Adds values")
		expect(tools[0]?.title).toBe("Calculator")
		expect(typeof tools[0]?.inputSchema).toBe("object")
	})
})
