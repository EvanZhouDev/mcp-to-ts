import { createMCPClient, type MCPClientConfig } from "@ai-sdk/mcp"
import {
	asSchema,
	type FlexibleSchema,
	type JSONSchema7,
	type ModelMessage,
	type Schema,
	type ToolExecutionOptions,
	TypeValidationError,
} from "ai"
import Ajv from "ajv"

type AjvValidator = {
	(value: unknown): boolean | PromiseLike<unknown>
	errors?: unknown
}

const ajv = new Ajv({ allErrors: true })
const schemaValidatorCache = new WeakMap<Schema<unknown>, AjvValidator>()

export type McpToolInfo = {
	name: string
	description?: string
	title?: string
	inputSchema: JSONSchema7
}

export type McpToolFunction<Input> = (args: Input) => Promise<unknown>

export type McpToolFunctions = Record<string, McpToolFunction<unknown>>

export type McpToolDefinition = {
	description?: string
	title?: string
	inputSchema: unknown
	execute?: (
		input: unknown,
		options: ToolExecutionOptions,
	) => Promise<unknown> | AsyncIterable<unknown> | unknown
}

export type McpToolSet = Record<string, McpToolDefinition>

type ValidationResult<INPUT> =
	| { success: true; value: INPUT }
	| { success: false; error: Error }

const isFlexibleSchema = (value: unknown): value is FlexibleSchema<unknown> => {
	if (typeof value === "function") {
		return true
	}
	if (typeof value !== "object" || value === null) {
		return false
	}
	if ("~standard" in value) {
		return true
	}
	return "jsonSchema" in value && "validate" in value
}

const ensureFlexibleSchema = (value: unknown): FlexibleSchema<unknown> => {
	if (isFlexibleSchema(value)) {
		return value
	}
	throw new Error("Tool input schema is not a supported schema.")
}

const readOptionalString = (
	value: unknown,
	key: string,
): string | undefined => {
	if (typeof value !== "object" || value === null) {
		return undefined
	}
	const propertyValue: unknown = Reflect.get(value, key)
	if (typeof propertyValue === "string") {
		return propertyValue
	}
	return undefined
}

const formatAjvErrors = (errors: unknown): string => {
	if (!Array.isArray(errors) || errors.length === 0) {
		return "Input did not match the expected schema."
	}
	const messages = errors.map((error, index) => {
		const message = readOptionalString(error, "message")
		const instancePath =
			readOptionalString(error, "instancePath") ??
			readOptionalString(error, "dataPath")
		const label =
			instancePath && instancePath.length > 0
				? instancePath
				: `error ${index + 1}`
		if (message) {
			return `${label}: ${message}`
		}
		return `${label}: invalid input`
	})
	return messages.join("; ")
}

const getAjvValidator = async <INPUT>(
	schema: Schema<INPUT>,
): Promise<AjvValidator> => {
	const cached = schemaValidatorCache.get(schema)
	if (cached) {
		return cached
	}
	const jsonSchema: JSONSchema7 = await Promise.resolve(schema.jsonSchema)
	const validator = ajv.compile(jsonSchema)
	schemaValidatorCache.set(schema, validator)
	return validator
}

const ensureSyncValidation = <INPUT>(
	validator: AjvValidator,
	value: unknown,
): value is INPUT => {
	const result = validator(value)
	if (typeof result !== "boolean") {
		throw new Error("Async JSON schema validation is not supported.")
	}
	return result
}

const buildValidatedSchema = async <INPUT>(
	schema: FlexibleSchema<INPUT>,
): Promise<Schema<INPUT>> => {
	const resolved = asSchema(schema)
	if (resolved.validate) {
		return resolved
	}
	const validator = await getAjvValidator(resolved)
	const validate = (value: unknown): ValidationResult<INPUT> => {
		if (ensureSyncValidation<INPUT>(validator, value)) {
			return { success: true, value }
		}
		const errorMessage = formatAjvErrors(validator.errors)
		return { success: false, error: new Error(errorMessage) }
	}
	return {
		...resolved,
		validate,
	}
}

const validateInput = async <INPUT>(
	value: unknown,
	schema: Schema<INPUT>,
): Promise<INPUT> => {
	if (!schema.validate) {
		throw new Error("Input schema does not provide validation.")
	}
	const result = await schema.validate(value)
	if (result.success) {
		return result.value
	}
	throw TypeValidationError.wrap({ value, cause: result.error })
}

const createExecutionOptions = (toolName: string): ToolExecutionOptions => {
	const messages: ModelMessage[] = []
	return {
		toolCallId: `mcp:${toolName}`,
		messages,
	}
}

const createToolWrapper = async (
	toolName: string,
	tool: McpToolDefinition,
): Promise<McpToolFunction<unknown>> => {
	const schema = await buildValidatedSchema(
		ensureFlexibleSchema(tool.inputSchema),
	)
	return async (args: unknown) => {
		const validated = await validateInput(args, schema)
		if (!tool.execute) {
			throw new Error(
				`MCP tool "${toolName}" does not have an execute function.`,
			)
		}
		return tool.execute(validated, createExecutionOptions(toolName))
	}
}

export const createMcpToolFunctions = async (
	toolset: McpToolSet,
): Promise<McpToolFunctions> => {
	const toolFunctions: McpToolFunctions = {}
	for (const toolName of Object.keys(toolset)) {
		const tool = toolset[toolName]
		if (!tool) {
			continue
		}
		toolFunctions[toolName] = await createToolWrapper(toolName, tool)
	}
	return toolFunctions
}

export const listMcpToolsFromToolSet = async (
	toolset: McpToolSet,
): Promise<McpToolInfo[]> => {
	const tools: McpToolInfo[] = []
	for (const toolName of Object.keys(toolset)) {
		const tool = toolset[toolName]
		if (!tool) {
			continue
		}
		const schema = asSchema(ensureFlexibleSchema(tool.inputSchema))
		const inputSchema: JSONSchema7 = await Promise.resolve(schema.jsonSchema)
		tools.push({
			name: toolName,
			description: tool.description,
			title: tool.title,
			inputSchema,
		})
	}
	return tools
}

export const getMcpToolsAsFunctions = async (
	config: MCPClientConfig,
): Promise<McpToolFunctions> => {
	const client = await createMCPClient(config)
	const toolset = await client.tools()
	return createMcpToolFunctions(toolset)
}

export const listMcpTools = async (
	config: MCPClientConfig,
): Promise<McpToolInfo[]> => {
	const client = await createMCPClient(config)
	const toolset = await client.tools()
	return listMcpToolsFromToolSet(toolset)
}
