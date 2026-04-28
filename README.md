# pi-find-your-llama
A [pi](https://pi.dev/) extension to add a running, local model to your pi config.

Press `Ctrl+Shift+L` or run `/find-llama` to detect models running locally and add them to your `models.json` config file.

## Install

```
pi install https://github.com/jgsheppa/pi-find-your-llama
```

For local development from this checkout:

```
pi -e ./findLlama.ts
```

Or install this directory as a local pi package:

```
pi install .
```

## Usage

`Ctrl+Shift+L` — show all models running locally.

`/find-llama` — fallback command for terminals that intercept Ctrl+Shift+L.

## Notes
- Make sure localhost:8080 is not being used by other applications
- Only running models will be detected


