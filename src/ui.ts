import type {
	ExtensionContext,
	ProviderConfig,
	ProviderModelConfig,
} from "@earendil-works/pi-coding-agent";
import { getModelDetails } from "./models";
import { type EditableField, filterInputTypes } from "./types";

/**
 * Custom multi-select UI component since pi-tui doesn't have one built-in.
 * Uses the select dialog in a loop, allowing users to toggle items on/off.
 */
export async function multiSelect(
	ctx: ExtensionContext,
	title: string,
	items: string[],
	defaultSelected: string[] = [],
): Promise<string[]> {
	const selected = new Set<string>(defaultSelected);
	const DONE_OPTION = "✓ Done - Confirm selection";
	const CANCEL_OPTION = "✗ Cancel";

	while (true) {
		const displayItems = items.map((item) =>
			selected.has(item) ? `[✓] ${item}` : `[ ] ${item}`,
		);

		const menuItems = [
			DONE_OPTION,
			CANCEL_OPTION,
			"─".repeat(30),
			...displayItems,
		];

		const selectedCount = selected.size;
		const menuTitle = `${title} (${selectedCount} selected)`;

		const choice = await ctx.ui.select(menuTitle, menuItems);

		if (!choice || choice === CANCEL_OPTION) {
			return []; // User cancelled
		}

		if (choice === DONE_OPTION) {
			return Array.from(selected);
		}

		if (choice.startsWith("─")) {
			continue;
		}

		const originalItem = choice.replace(/^\[.\] /, "");
		if (selected.has(originalItem)) {
			selected.delete(originalItem);
		} else {
			selected.add(originalItem);
		}
	}
}

function getFieldValue(
	providerConfig: ProviderConfig,
	modelConfig: ProviderModelConfig,
	field: EditableField,
) {
	switch (field) {
		case "id":
			return modelConfig.id;
		case "name":
			return modelConfig.name ?? "";
		case "reasoning":
			return modelConfig.reasoning ? "Yes" : "No";
		case "input":
			return modelConfig.input?.join(", ") ?? "";
		case "contextWindow":
			return String(modelConfig.contextWindow ?? "");
		case "maxTokens":
			return String(modelConfig.maxTokens ?? "");
		case "compat":
			return String(modelConfig.compat ?? "");
		case "cost.input":
			return String(modelConfig.cost?.input ?? 0);
		case "cost.output":
			return String(modelConfig.cost?.output ?? 0);
		case "cost.cacheRead":
			return String(modelConfig.cost?.cacheRead ?? 0);
		case "cost.cacheWrite":
			return String(modelConfig.cost?.cacheWrite ?? 0);
		case "baseUrl":
			return String(providerConfig.baseUrl ?? "");
		case "api":
			return String(providerConfig.api ?? "");
		case "apiKey":
			return String(providerConfig.apiKey ?? "");
	}
}

export async function promptForFieldValue(
	ctx: ExtensionContext,
	providerConfig: ProviderConfig,
	modelConfig: ProviderModelConfig,
	field: EditableField,
) {
	switch (field) {
		case "reasoning": {
			const selected = await ctx.ui.select("Use reasoning?", ["Yes", "No"]);
			return typeof selected === "undefined" ? undefined : selected === "Yes";
		}
		case "input": {
			const selectedInputTypes = filterInputTypes(
				await multiSelect(
					ctx,
					"Select input types the model supports",
					["text", "image"],
					modelConfig.input ?? [],
				),
			);
			return selectedInputTypes.length > 0 ? selectedInputTypes : undefined;
		}
		case "contextWindow": {
			const value = await ctx.ui.input(
				"Context window size (number of tokens the model can take as input)",
				String(modelConfig.contextWindow ?? 128000),
				{ timeout: 30000 },
			);
			return value && /^\d+$/.test(value.trim())
				? parseInt(value.trim(), 10)
				: undefined;
		}
		case "maxTokens": {
			const value = await ctx.ui.input(
				"Max tokens (number of tokens the model can output)",
				String(modelConfig.maxTokens ?? 16384),
				{ timeout: 30000 },
			);
			return value && /^\d+$/.test(value.trim())
				? parseInt(value.trim(), 10)
				: undefined;
		}
		case "cost.input":
		case "cost.output":
		case "cost.cacheRead":
		case "cost.cacheWrite": {
			const currentValue = getFieldValue(providerConfig, modelConfig, field);
			const value = await ctx.ui.input(`Enter ${field} value`, currentValue, {
				timeout: 60000,
			});
			return value && !Number.isNaN(Number(value))
				? parseFloat(value)
				: undefined;
		}
		case "id":
		case "name":
		case "compat":
		case "baseUrl":
		case "api":
		case "apiKey": {
			const currentValue = getFieldValue(providerConfig, modelConfig, field);
			const value = await ctx.ui.input(`Enter ${field} value`, currentValue, {
				timeout: 30000,
			});
			return value?.trim() || undefined;
		}
	}
}

export async function listModelsUI(
	ctx: ExtensionContext,
	config: ProviderConfig,
) {
	try {
		const modelList = await getModelDetails(ctx, config);
		const modelUIList = modelList.map(
			({ id, owned_by }) => `${owned_by} | ${id}`,
		);
		const selectedModel = await ctx.ui.select("Available models", modelUIList);

		if (!selectedModel) {
			ctx.ui.notify("Cancelled.", "warning");
			return;
		}

		return modelList.find((model) => selectedModel.includes(model.id));
	} catch (error) {
		ctx.ui.notify(
			`Error: ${error instanceof Error ? error.message : String(error)}`,
			"error",
		);
		throw error;
	}
}

export function getFieldOptions(): Array<{
	label: string;
	value: EditableField;
}> {
	return [
		{ label: "Model ID", value: "id" },
		{ label: "Model name", value: "name" },
		{ label: "Reasoning", value: "reasoning" },
		{ label: "Supported input types", value: "input" },
		{ label: "Context window", value: "contextWindow" },
		{ label: "Max tokens", value: "maxTokens" },
		{ label: "Compatibility", value: "compat" },
		{ label: "Cost - input", value: "cost.input" },
		{ label: "Cost - output", value: "cost.output" },
		{ label: "Cost - cache read", value: "cost.cacheRead" },
		{ label: "Cost - cache write", value: "cost.cacheWrite" },
		{ label: "Provider base URL", value: "baseUrl" },
		{ label: "Provider API", value: "api" },
		{ label: "Provider API key", value: "apiKey" },
	];
}
