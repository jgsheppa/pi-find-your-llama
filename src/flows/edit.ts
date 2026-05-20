import type {
	ExtensionContext,
	ProviderModelConfig,
} from "@mariozechner/pi-coding-agent";
import { applyFieldValue, loadModelConfig, saveModelConfig } from "../config";
import type { Provider } from "../types";
import { getFieldOptions, promptForFieldValue } from "../ui";

function getProviderEntries(config: Provider) {
	return Object.entries(config.providers)
		.map(([providerName, providerConfig]) => ({
			providerName,
			providerConfig,
			modelCount: providerConfig.models?.length ?? 0,
		}))
		.filter(({ modelCount }) => modelCount > 0);
}

function getModelLabel(model: ProviderModelConfig) {
	return model.name && model.name !== model.id
		? `${model.id} (${model.name})`
		: model.id;
}

export async function handleEditModelFlow(ctx: ExtensionContext) {
	const config = await loadModelConfig();
	const providerEntries = getProviderEntries(config);

	if (providerEntries.length === 0) {
		ctx.ui.notify("No models found in models.json to edit.", "warning");
		return;
	}

	const providerOptions = providerEntries.map(
		({ providerName, modelCount }) => `${providerName} (${modelCount} models)`,
	);

	const selectedProvider = await ctx.ui.select(
		"Select a provider to edit",
		providerOptions,
	);

	if (!selectedProvider) {
		ctx.ui.notify("Cancelled.", "warning");
		return;
	}

	const providerName = selectedProvider.replace(/ \(\d+ models\)$/, "");
	const providerConfig = config.providers[providerName];
	const models: ProviderModelConfig[] = providerConfig.models ?? [];

	if (models.length === 0) {
		ctx.ui.notify("Selected provider has no models.", "warning");
		return;
	}

	const selectedModelLabel = await ctx.ui.select(
		"Select a model to edit",
		models.map((model) => getModelLabel(model)),
	);

	if (!selectedModelLabel) {
		ctx.ui.notify("Cancelled.", "warning");
		return;
	}

	const modelIndex = models.findIndex(
		(model) => getModelLabel(model) === selectedModelLabel,
	);
	if (modelIndex < 0) {
		ctx.ui.notify("Model not found.", "error");
		return;
	}

	const modelConfig = models[modelIndex];
	const fieldOptions = getFieldOptions();

	while (true) {
		const selectedField = await ctx.ui.select("Select a field to edit", [
			"✓ Save - Apply changes",
			...fieldOptions.map((field) => field.label),
		]);

		if (selectedField === "✓ Save - Apply changes") {
			const ok = await ctx.ui.confirm(
				"Apply changes?",
				"This will update the models.json file",
			);

			if (ok) {
				break;
			} else {
				continue;
			}
		}

		if (!selectedField) {
			break;
		}

		const field = fieldOptions.find(
			(option) => option.label === selectedField,
		)?.value;

		if (!field) {
			continue;
		}

		const value = await promptForFieldValue(
			ctx,
			providerConfig,
			modelConfig,
			field,
		);

		if (typeof value === "undefined") {
			continue;
		}

		const hasModelIdConflict =
			field === "id" &&
			models.some(
				(model, index) => index !== modelIndex && model.id === String(value),
			);

		if (hasModelIdConflict) {
			ctx.ui.notify("Another model already uses that ID.", "error");
			continue;
		}

		applyFieldValue(providerConfig, modelConfig, field, value);
		await saveModelConfig(config);
		ctx.ui.notify(`Updated ${selectedField}.`, "info");
	}

	await saveModelConfig(config);
	ctx.ui.notify(`Model ${getModelLabel(modelConfig)} updated!`, "info");
}
