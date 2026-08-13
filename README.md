> **Path assumptions:** the desktop app and plugins are **relocatable** — they
> derive config, data, and script paths from their own location. The only
> machine-specific path is the DeepSeek Harness checkout, which defaults to
> `D:\deepseek harness` and can be changed per-install via the `serverWorkDir`
> key in `config.json`, or per-launch with `--workdir`.