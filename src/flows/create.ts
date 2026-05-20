import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { withOpenAIConfig } from "../config";
import { registerModel } from "../models";
import { listModelsUI } from "../ui";

export async function handleCreateModelFlow(ctx: ExtensionContext) {
	const baseUrlInput = await ctx.ui.input(
		"Enter the base URL for the OpenAI-compatible API (e.g. http://localhost:8080/v1)",
		"http://localhost:8080/v1",
		{
			timeout: 60000,
		},
	);
	if (!baseUrlInput) {
		ctx.ui.notify("No url entered. Cancelled.", "warning");
		return;
	}

	const baseUrl = baseUrlInput.trim();
	if (!/^http:\/\/localhost:\d+\/v1$/.test(baseUrl)) {
		ctx.ui.notify("Invalid base URL. Cancelled.", "error");
		return;
	}

	const config = withOpenAIConfig(baseUrl);
	const model = await listModelsUI(ctx, config);
	if (model) {
		return await registerModel(ctx, config, model);
	} else {
		ctx.ui.notify("No model selected", "warning");
	}
}
