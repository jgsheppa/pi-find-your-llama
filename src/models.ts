import type {
	ExtensionContext,
	ProviderConfig,
	ProviderModelConfig,
} from "@mariozechner/pi-coding-agent";
import { loadModelConfig, saveModelConfig } from "./config";
import { filterInputTypes, type ModelInputType } from "./types";
import { multiSelect } from "./ui";

export async function registerModel(
	ctx: ExtensionContext,
	provider: ProviderConfig,
	model: { id: string; owned_by: string },
) {
	try {
		ctx.ui.setStatus("pi-find-your-llama", "Finding your llama...");

		const config = await loadModelConfig();

		const owner = model.owned_by;

		/**
		 * newModel uses the defaults defined in pi's docs: https://pi.dev/docs/latest/models#model-configuration
		 */
		const newModel: ProviderModelConfig = {
			id: model.id,
			name: model.id,
			reasoning: false,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			compat: undefined,
			input: ["text"],
			contextWindow: 128000,
			maxTokens: 16384,
		};

		const selectDefaults = await ctx.ui.select("Use default settings?", [
			"Yes",
			"No",
		]);

		if (selectDefaults === "No") {
			const selectReasoning = await ctx.ui.select("Use reasoning?", [
				"Yes",
				"No",
			]);
			newModel.reasoning = selectReasoning === "Yes";

			const contextWindowInput = await ctx.ui.input(
				"Context window size (number of tokens the model can take as input)",
				String(newModel.contextWindow),
				{ timeout: 30000 },
			);
			if (contextWindowInput && /^\d+$/.test(contextWindowInput.trim())) {
				newModel.contextWindow = parseInt(contextWindowInput.trim(), 10);
			}

			const maxTokensInput = await ctx.ui.input(
				"Max tokens (number of tokens the model can output)",
				String(newModel.maxTokens),
				{ timeout: 30000 },
			);
			if (maxTokensInput && /^\d+$/.test(maxTokensInput.trim())) {
				newModel.maxTokens = parseInt(maxTokensInput.trim(), 10);
			}

			const inputTypes: ModelInputType[] = ["text", "image"];
			const selectedInputTypes = filterInputTypes(
				await multiSelect(
					ctx,
					"Select input types the model supports",
					inputTypes,
				),
			);
			if (selectedInputTypes.length > 0) {
				newModel.input = selectedInputTypes;
			}

			const updateCost = await ctx.ui.select("Update cost settings?", [
				"Yes",
				"No",
			]);
			if (updateCost === "Yes") {
				const costInput = await ctx.ui.input("Enter cost input", "0", {
					timeout: 60000,
				});
				const costOutput = await ctx.ui.input("Enter cost output", "0", {
					timeout: 60000,
				});
				const costCacheRead = await ctx.ui.input("Enter cost cache read", "0", {
					timeout: 60000,
				});
				const costCacheWrite = await ctx.ui.input(
					"Enter cost cache write",
					"0",
					{ timeout: 60000 },
				);

				newModel.cost = {
					input:
						costInput && !Number.isNaN(Number(costInput))
							? parseFloat(costInput)
							: 0,
					output:
						costOutput && !Number.isNaN(Number(costOutput))
							? parseFloat(costOutput)
							: 0,
					cacheRead:
						costCacheRead && !Number.isNaN(Number(costCacheRead))
							? parseFloat(costCacheRead)
							: 0,
					cacheWrite:
						costCacheWrite && !Number.isNaN(Number(costCacheWrite))
							? parseFloat(costCacheWrite)
							: 0,
				};
			}
		}

		if (config.providers[owner]) {
			const modelExists = config.providers[owner]?.models?.some(
				(m: ProviderModelConfig) => m.id === model.id,
			);

			if (modelExists) {
				ctx.ui.notify(`Model ${model.id} already registered`, "warning");
				return;
			}
			config.providers[owner].models?.push(newModel);
		} else {
			config.providers[owner] = {
				baseUrl: provider.baseUrl,
				api: provider.api,
				apiKey: provider.apiKey,
				models: [newModel],
			};
		}

		ctx.ui.setStatus("pi-find-your-llama", undefined);

		await saveModelConfig(config);

		ctx.ui.notify(`Model ${model.id} added to models.json!`, "info");

		return { owner, modelId: newModel.id };
	} catch (error) {
		ctx.ui.notify(
			`Error: ${error instanceof Error ? error.message : String(error)}`,
			"error",
		);
		throw error;
	}
}

function convertOwnerName(owner: string, args?: string[]) {
	if (args?.some((arg) => arg.includes("LlamaBarn.app"))) {
		return "LlamaBarn";
	}
	if (owner === "library") {
		return "ollama";
	}
	if (owner === "llamacpp") {
		return "llama-cpp";
	}
	return "custom-provider";
}

export async function getModelDetails(
	ctx: ExtensionContext,
	config: ProviderConfig,
) {
	const response = await fetch(`${config.baseUrl}/models`);

	if (!response.ok) {
		throw new Error(`Failed to fetch models: ${response.statusText}`);
	}

	const models = (await response.json()) as {
		object: string;
		data: Array<{
			id: string;
			aliases: string[];
			tags: string[];
			object: string;
			owned_by: string;
			created: number;
			status: {
				value: string;
				args: string[];
				preset: string;
			};
		}>;
	};

	if (!models.data || models.data.length === 0) {
		throw new Error("No models found from the API");
	}

	const providerNames = Array.from(
		new Set(models.data.map((model) => convertOwnerName(model.owned_by))),
	);
	const selectedProvider = await ctx.ui.select(
		"The following providers have been detected. Choose 'other' to enter an alternate provider name",
		[...providerNames, "other"],
	);

	if (selectedProvider === "other") {
		const customProvider = await ctx.ui.input(
			"Enter the provider name for these models",
			"custom-provider",
			{
				timeout: 30000,
			},
		);
		return models.data.map(({ id }) => ({
			id,
			owned_by: customProvider?.trim() ?? "custom-provider",
		}));
	}

	return models.data.map(({ id }) => ({
		id,
		owned_by: selectedProvider ?? "custom-provider",
	}));
}
