import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import OpenAI from "openai";
import { readFile, writeFile, mkdir } from "fs/promises";
import { homedir } from "os";
import { join, dirname } from "path";

const OPENAI_CONFIG = {
  baseURL: "http://localhost:8080/v1",
  api: "openai-completions",
  apiKey: "no-key",
} as const;

const MODEL_CONFIG_LOCATION = join(homedir(), ".pi/agent/models.json");

export default function (pi: ExtensionAPI) {
  async function getModelDetails() {
    const client = new OpenAI(OPENAI_CONFIG);

    const models = await client.models.list();

    if (!models.data || models.data.length === 0) {
      throw new Error("No models found from the API");
    }

    const modelDetails = models.data.map(({ id, owned_by }) => ({
      id,
      owned_by: convertOwnerName(owned_by),
    }));

    return modelDetails;
  }

  async function formatModelsForUI() {
    return (await getModelDetails()).map(
      ({ id, owned_by }) => `${owned_by} | ${id}`,
    );
  }

  async function listModelsUI(ctx: ExtensionContext) {
    try {

      const modelList = await getModelDetails();
      const modelUIList = await formatModelsForUI();
      const selectedModel = await ctx.ui.select("Available models", modelUIList);
      
      if (!selectedModel) {
        ctx.ui.notify("Cancelled.", "warning");
        return;
      }
      
      return modelList.find((model) => selectedModel.includes(model.id));
    } catch (error) {
      ctx.ui.notify(
        "Could not find models. Make sure your local API is running and accessible at localhost:8080.",
        "error",
      );
      throw error;
    }
  }

  function convertOwnerName(owner: string) {
    return owner === "llamacpp" ? "llama-cpp" : owner;
  }

  async function registerModel(
    ctx: ExtensionContext,
    model: { id: string; owned_by: string },
  ) {
    try {
      ctx.ui.notify("Reading config file...", "info");

      await mkdir(dirname(MODEL_CONFIG_LOCATION), { recursive: true });

      let config: any = { providers: {} };
      try {
        const raw = await readFile(MODEL_CONFIG_LOCATION, "utf-8");
        config = JSON.parse(raw);
      } catch (error) {
        console.log("Config file doesn't exist, creating new one");
      }

      const owner = model.owned_by;
      const newModel = { id: model.id };

      if (config.providers[owner]) {
        const modelExists = config.providers[owner].models.some(
          (m: any) => m.id === model.id,
        );

        if (modelExists) {
          ctx.ui.notify(`Model ${model.id} already registered`, "warning");
          return;
        }

        config.providers[owner].models.push(newModel);
      } else {
        config.providers[owner] = {
          baseUrl: OPENAI_CONFIG.baseURL,
          api: OPENAI_CONFIG.api,
          apiKey: OPENAI_CONFIG.apiKey,
          models: [newModel],
        };
      }

      ctx.ui.notify("Writing to config file...", "info");

      await writeFile(MODEL_CONFIG_LOCATION, JSON.stringify(config, null, 2));

      ctx.ui.notify(`Model ${model.id} added! Reload Pi to use it.`, "info");
    } catch (error) {
      console.error("Error registering model:", error);
      ctx.ui.notify(
        `Error: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
      throw error;
    }
  }

  async function handleFindModelShortcut(ctx: ExtensionContext) {
    const model = await listModelsUI(ctx);
    if (model) {
      await registerModel(ctx, model);
    } else {
      ctx.ui.notify("No model selected", "warning");
    }
  }

  async function handleFindModelCommand(_args: string, ctx: ExtensionContext) {
    const model = await listModelsUI(ctx);
    if (model) {
      await registerModel(ctx, model);
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
