import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type {
	ExtensionAPI,
	ExtensionContext,
	ProviderConfig,
	ProviderModelConfig,
} from "@mariozechner/pi-coding-agent";

const MODEL_CONFIG_LOCATION = join(homedir(), ".pi/agent/models.json");

type Provider = {
	providers: Record<string, ProviderConfig>;
};

type InputType = "text" | "image";

function isInputType(value: string): value is InputType {
	return value === "text" || value === "image";
}

function filterInputTypes(values: string[]): InputType[] {
	return values.filter(isInputType);
}

/**
 * Custom multi-select UI component since pi-tui doesn't have one built-in.
 * Uses the select dialog in a loop, allowing users to toggle items on/off.
 */
async function multiSelect(
	ctx: ExtensionContext,
	title: string,
	items: string[],
): Promise<string[]> {
	const selected = new Set<string>();
	const DONE_OPTION = "✓ Done - Confirm selection";
	const CANCEL_OPTION = "✗ Cancel";

	while (true) {
		const displayItems = items.map((item) =>
			selected.has(item) ? `[✓] ${item}` : `[ ] ${item}`,
		);

		const menuItems = [
			DONE_OPTION,
			CANCEL_OPTION,
			"─".repeat(30), // Separator
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

export default function (pi: ExtensionAPI) {
	async function getModelDetails(config: ProviderConfig) {
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

		return models.data.map(({ id, owned_by, status }) => ({
			id,
			owned_by: convertOwnerName(owned_by, status?.args),
		}));
	}

	async function formatModelsForUI(config: ProviderConfig) {
		return (await getModelDetails(config)).map(
			({ id, owned_by }) => `${owned_by} | ${id}`,
		);
	}

	async function listModelsUI(ctx: ExtensionContext, config: ProviderConfig) {
		try {
			const modelList = await getModelDetails(config);
			const modelUIList = await formatModelsForUI(config);
			const selectedModel = await ctx.ui.select(
				"Available models",
				modelUIList,
			);

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

	async function registerModel(
		ctx: ExtensionContext,
		provider: ProviderConfig,
		model: { id: string; owned_by: string },
	) {
		try {
			ctx.ui.setStatus("pi-find-your-llama", "Finding your llama...");

			let config: Provider = { providers: {} };

			try {
				const raw = await readFile(MODEL_CONFIG_LOCATION, "utf-8");
				config = JSON.parse(raw);
			} catch {
				// File doesn't exist yet, create the directory
				await mkdir(dirname(MODEL_CONFIG_LOCATION), { recursive: true });
			}

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

				const inputTypes: InputType[] = ["text", "image"];
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
					const costCacheRead = await ctx.ui.input(
						"Enter cost cache read",
						"0",
						{ timeout: 60000 },
					);
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

			await writeFile(MODEL_CONFIG_LOCATION, JSON.stringify(config, null, 2));

			ctx.ui.notify(`Model ${model.id} added!`, "info");
		} catch (error) {
			ctx.ui.notify(
				`Error: ${error instanceof Error ? error.message : String(error)}`,
				"error",
			);
			throw error;
		}
	}

	function withOpenAIConfig(port: string): ProviderConfig {
		return {
			baseUrl: `http://localhost:${port}/v1`,
			api: "openai-completions",
			apiKey: "sk-no-key-required",
			models: [],
		};
	}

	async function handleFindModelShortcut(ctx: ExtensionContext) {
		const portInput = await ctx.ui.input(
			"Enter the port your local API is running on",
			"8080",
			{
				timeout: 30000,
			},
		);
		if (!portInput) {
			ctx.ui.notify("No port entered. Cancelled.", "warning");
			return;
		}

		const port = portInput.trim();
		if (!/^\d+$/.test(port)) {
			ctx.ui.notify("Invalid port number. Cancelled.", "error");
			return;
		}

		const config = withOpenAIConfig(port);
		const model = await listModelsUI(ctx, config);
		if (model) {
			await registerModel(ctx, config, model);
		} else {
			ctx.ui.notify("No model selected", "warning");
		}
	}

	async function handleFindModelCommand(_args: string, ctx: ExtensionContext) {
		const portInput = await ctx.ui.input(
			"Enter the port your local API is running on",
			"8080",
			{
				timeout: 30000,
			},
		);
		if (!portInput) {
			ctx.ui.notify("No port entered. Cancelled.", "warning");
			return;
		}

		const port = portInput.trim();
		if (!/^\d+$/.test(port)) {
			ctx.ui.notify("Invalid port number. Cancelled.", "error");
			return;
		}

		const config = withOpenAIConfig(port);

		const model = await listModelsUI(ctx, config);
		if (model) {
			await registerModel(ctx, config, model);
		} else {
			ctx.ui.notify("No model selected", "warning");
		}
	}

	pi.registerShortcut("ctrl+shift+l", {
		description: "Find local models and add them to the pi config",
		handler: async (ctx) => {
			await handleFindModelShortcut(ctx);
		},
	});

	pi.registerCommand("find-llama", {
		description: "Find local models and add them to the pi config",
		handler: async (_args, ctx) => {
			await handleFindModelCommand(_args, ctx);
		},
	});
}
