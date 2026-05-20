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





