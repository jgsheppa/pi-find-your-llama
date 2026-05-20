import type {
	ExtensionAPI,
	ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { handleCreateModelFlow } from "./create";
import { handleEditModelFlow } from "./edit";

export async function handleModelFlow(ctx: ExtensionContext, pi: ExtensionAPI) {
	const action = await ctx.ui.select(
		"Would you like to create or edit a model in models.json?",
		["Create", "Edit"],
	);

	if (!action) {
		ctx.ui.notify("Cancelled.", "warning");
		return;
	}

	if (action === "Create") {
		const result = await handleCreateModelFlow(ctx);
		if (!result) {
			ctx.ui.notify("No model was created.", "warning");
			return;
		}

		const useModel = await ctx.ui.select("Would you like use this model now?", [
			"Yes",
			"No",
		]);

		if (!result?.modelId || !result?.owner) {
			ctx.ui.notify(
				"Model registration did not return owner or model ID. Cannot load model.",
				"error",
			);
			return;
		}

		if (useModel === "Yes") {
			const model = ctx.modelRegistry.find(result.owner, result.modelId);
			ctx.ui.setStatus(
				`Loading model ${result.modelId} from provider ${result.owner}...`,
				"info",
			);
			if (model) {
				const success = await pi.setModel(model);
				if (!success) {
					ctx.ui.notify("Could not load model", "error");
				}
			}
			ctx.ui.setStatus("", "info");
		}
		return;
	}

	await handleEditModelFlow(ctx);
}
