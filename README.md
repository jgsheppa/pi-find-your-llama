# pi-find-your-llama
A [pi](https://pi.dev/) extension to add a running, local model to your pi config.

Press `Ctrl+Shift+L` or run `/find-llama` to detect models running locally and add them to your `models.json` config file.

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



## Decision Tree

Possible starting states:

1. New Provider
2. Existing Provider

