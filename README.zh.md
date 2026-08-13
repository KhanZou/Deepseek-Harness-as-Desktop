> **路径约定**：桌面客户端与插件**可重定位**——配置、数据、脚本路径均从
> 自身位置推导。唯一与机器相关的路径是 DeepSeek Harness 检出目录，默认为
> `D:\deepseek harness`，可通过 `config.json` 的 `serverWorkDir` 键按安装修改，
> 或每次启动用 `--workdir` 覆盖。