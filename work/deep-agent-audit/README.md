# 0.9.26 独立 Agent 诊断

在诊断worktree根目录运行，依赖现有node_modules，业务基线bd2d82c。脚本只写隔离outputs/work、临时工程，不修改产品实现。

## 离线逻辑

```sh
node_modules/.bin/esbuild work/deep-agent-audit/local.ts --bundle --platform=node --format=cjs --outfile=work/deep-agent-audit/local.cjs
node work/deep-agent-audit/local.cjs
```

## 正式Command / Tool / 原生Canvas对照

```sh
node_modules/.bin/esbuild work/deep-agent-audit/main-local.ts --bundle --platform=node --format=cjs --external:electron --outfile=work/deep-agent-audit/main-local.cjs
node_modules/.bin/esbuild work/deep-agent-audit/renderer-local.ts --bundle --platform=browser --format=iife --outfile=work/deep-agent-audit/renderer-local.js
node_modules/.bin/electron work/deep-agent-audit/main-local.cjs
```

## 真实DeepSeek（付费；默认CI不得运行）

用户已授权本次运行。再次执行需核对授权/额度/配置。main通过现有NativeAIService读取安全凭据，日志只写请求/响应，不写Key。仅临时工程，不发参考图或渲染图。脚本读取启用的DeepSeek及其defaultModel；本次实际deepseek-flash，隐私与agent设置只在内存覆盖。

```sh
node_modules/.bin/esbuild work/deep-agent-audit/main.ts --bundle --platform=node --format=cjs --external:electron --outfile=work/deep-agent-audit/main.cjs
node_modules/.bin/esbuild work/deep-agent-audit/renderer.ts --bundle --platform=browser --format=iife --outfile=work/deep-agent-audit/renderer.js
node_modules/.bin/electron work/deep-agent-audit/main.cjs
```

extended的对应入口是main-extended.ts/renderer-extended.ts，产物main-extended.cjs/renderer-extended.js。先创建outputs/deep-agent-audit。输出会覆盖同名证据，再跑前请改到新的专用诊断目录保留本次证据。不能复制电子缓存/userdata或凭据到Git。

A为5190隔离origin的普通UI手工自动化，记录ui-evidence.json与截图。早期local-probes B使用Adapter生成命令、Undo用identity比较；后续local-render独立构造B，live/extended按内容等价Undo取代，报告明确保留此限制。
