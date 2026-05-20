import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type {
	ProviderConfig,
	ProviderModelConfig,
} from "@mariozechner/pi-coding-agent";
import type { EditableField, ModelInputType, Provider } from "./types";

const MODEL_CONFIG_LOCATION = join(homedir(), ".pi/agent/models.json");

export async function loadModelConfig(): Promise<Provider> {
	try {
		const raw = await readFile(MODEL_CONFIG_LOCATION, "utf-8");
		return JSON.parse(raw) as Provider;
	} catch {
		return { providers: {} };
	}
}

export async function saveModelConfig(config: Provider) {
	await mkdir(dirname(MODEL_CONFIG_LOCATION), { recursive: true });
	await writeFile(MODEL_CONFIG_LOCATION, JSON.stringify(config, null, 2));
}

export function withOpenAIConfig(baseUrl: string): ProviderConfig {
	return {
		baseUrl,
		api: "openai-completions",
		apiKey: "apiKey",
		models: [],
	};
}

export function applyFieldValue(
	providerConfig: ProviderConfig,
	modelConfig: ProviderModelConfig,
	field: EditableField,
	value: unknown,
) {
	switch (field) {
		case "id":
			modelConfig.id = String(value);
			return;
		case "name":
			modelConfig.name = String(value);
			return;
		case "reasoning":
			modelConfig.reasoning = Boolean(value);
			return;
		case "input":
			modelConfig.input = Array.isArray(value)
				? (value as ModelInputType[])
				: [];
			return;
		case "contextWindow":
			modelConfig.contextWindow = Number(value);
			return;
		case "maxTokens":
			modelConfig.maxTokens = Number(value);
			return;
		case "cost.input":
			modelConfig.cost = {
				input: Number(value),
				output: modelConfig.cost?.output ?? 0,
				cacheRead: modelConfig.cost?.cacheRead ?? 0,
				cacheWrite: modelConfig.cost?.cacheWrite ?? 0,
			};
			return;
		case "cost.output":
			modelConfig.cost = {
				input: modelConfig.cost?.input ?? 0,
				output: Number(value),
				cacheRead: modelConfig.cost?.cacheRead ?? 0,
				cacheWrite: modelConfig.cost?.cacheWrite ?? 0,
			};
			return;
		case "cost.cacheRead":
			modelConfig.cost = {
				input: modelConfig.cost?.input ?? 0,
				output: modelConfig.cost?.output ?? 0,
				cacheRead: Number(value),
				cacheWrite: modelConfig.cost?.cacheWrite ?? 0,
			};
			return;
		case "cost.cacheWrite":
			modelConfig.cost = {
				input: modelConfig.cost?.input ?? 0,
				output: modelConfig.cost?.output ?? 0,
				cacheRead: modelConfig.cost?.cacheRead ?? 0,
				cacheWrite: Number(value),
			};
			return;
		case "baseUrl":
			providerConfig.baseUrl = String(value);
			return;
		case "api":
			providerConfig.api = String(value);
			return;
		case "apiKey":
			providerConfig.apiKey = String(value);
			return;
	}
}
