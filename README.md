# pi-find-your-llama
A [pi](https://pi.dev/) extension to add or edit a local models for your `pi` config.

Press `Ctrl+Shift+L` or run `/find-llama` to detect local models and add or edit them in your `models.json` config file.

## Install

```
pi install https://github.com/jgsheppa/pi-find-your-llama
```

For local development from this checkout:

```
pi -e ./src/index.ts
```

Or install this directory as a local pi package:

```
pi install .
```

## Usage

`Ctrl+Shift+L` — show all models running locally.

`/find-llama` — fallback command for terminals that intercept Ctrl+Shift+L.

### Creating and editing entries for local models in `models.json`

After initiating the extension, there are two options: create or edit. Creating a new model with a new provider is trivial with this extension and can be done quickly, so you can get the latest OS models up and running with your `pi` setup. 

You will be prompted for the base URL of your local setup, which might look something like `http://localhost:8080/v1`. This is used to fetch the models from the URL's `/models` endpoint. 

You can then choose to use the default settings, or whether to customize your config. If you accept the default config for a model, it will look like this in:

```json
{
    id: [MODEL_ID],
    name: [MODEL_ID],
    reasoning: false,
    cost: 
        { 
            input: 0, 
            output: 0, 
            cacheRead: 0, 
            cacheWrite: 0 
        },
    compat: undefined,
    input: ["text"],
    contextWindow: 128000,
    maxTokens: 16384,
}
```

These defaults are taken from pi's documentation, which can be found [here](https://pi.dev/docs/latest/models#model-configuration).

Once you have created a model, you can go back at any time to update a provider or its models using this extension. 

One field which has been left out for the moment is `compat`, but this could be added in the future if it feels necessary.


