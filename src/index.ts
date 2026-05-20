import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { handleModelFlow } from "./flows";

export default function (pi: ExtensionAPI) {
	pi.registerShortcut("ctrl+shift+l", {
		description:
			"Find local models and add or edit their configuration in models.json",
		handler: async (ctx) => {
			await handleModelFlow(ctx, pi);
		},
	});

	pi.registerCommand("find-llama", {
		description:
			"Find local models and add or edit their configuration in models.json",
		handler: async (_args, ctx) => {
			await handleModelFlow(ctx, pi);
		},
	});
}
