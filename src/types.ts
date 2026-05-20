import type { ProviderConfig } from "@mariozechner/pi-coding-agent";

export type Provider = {
	providers: Record<string, ProviderConfig>;
};

export type ModelInputType = "text" | "image";

export type EditableField =
	| "id"
	| "name"
	| "reasoning"
	| "input"
	| "contextWindow"
	| "maxTokens"
	| "compat"
	| "cost.input"
	| "cost.output"
	| "cost.cacheRead"
	| "cost.cacheWrite"
	| "baseUrl"
	| "api"
	| "apiKey";

export function isInputType(value: string): value is ModelInputType {
	return value === "text" || value === "image";
}

export function filterInputTypes(values: string[]): ModelInputType[] {
	return values.filter(isInputType);
}
