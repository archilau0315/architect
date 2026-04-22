---
name: fix-image-generation-api-key-missing
overview: 修复生图功能 "API key is missing" 错误，在 gateway_config.json 中添加缺失的图像模型网关配置
design:
  architecture:
    framework: react
todos:
  - id: fix-gateway-config
    content: 在 config/gateway_config.json 的 models 中添加 gemini-3.1-flash-image-preview、gemini-3-pro-image-preview 两个图像模型的 ph8 网关节点配置
    status: completed
  - id: verify-fix
    content: 验证修改后的 JSON 格式正确性，确认图像生成调用链路能正确匹配到 ph8 网关节点
    status: completed
    dependencies:
      - fix-gateway-config
---

## 产品概述

首席图像架构师（Chief Image Architect）平台的图像生成功能完全不可用，用户触发生图后收到错误提示："AI API key is missing. Please provide a valid API key."，而聊天（chat）的三个功能均正常工作。

## 核心问题

**根因：`gateway_config.json` 缺少图像生成模型的网关节点配置。**

完整调用链路如下：

```
用户点击生成图片
  → ImageGenerator.tsx 调用 GeminiService.generateImage()
    → 模型名解析为 "gemini-3.1-flash-image-preview"（默认）
    → getAI(modelConfig, model) 被调用
      → 查询 gatewayConfig.models["gemini-3.1-flash-image-preview"]
      → 结果：undefined（配置文件中不存在此模型！）
      → selectedNode = null, baseUrl = undefined
    → shouldUseThirdPartyFormat = false（因为 node 为 null）
    → 进入 else 分支（第 1307 行）
    → new GoogleGenAI({ apiKey: '' })  ← 空字符串！
    → Google GenAI SDK 抛出 "API key is missing" 错误
```

**为什么聊天正常？** 因为聊天使用的模型（`gemini-3-flash-preview`、`deepseek-v3.2`、`gemini-3-pro-preview` 等）在 `gateway_config.json` 的 `models` 中都有配置，能找到 ph8 网关节点，走 fetch 代理路径成功请求。

## 需要修复的内容

1. 在 `config/gateway_config.json` 的 `models` 中添加所有被 `generateImage()` 引用但缺失的图像模型网关配置
2. 验证修复后图像生成的完整链路可通

## 技术栈

- **前端框架**: React 19 + TypeScript + Vite
- **AI SDK**: @google/genai（GoogleGenAI 客户端）
- **网关路由**: 通过 Vite 开发代理（/api/ph8 -> https://ph8.co/v1）或生产环境 Nginx 代理
- **配置驱动**: `config/gateway_config.json` 决定每个模型的路由节点

## 根因分析详情

### 问题定位

| 文件 | 行号 | 内容 | 状态 |
| --- | --- | --- | --- |
| `services/geminiService.ts` | 147 | `const getNextApiKey = (): string => '';` | 前端不持有任何 API Key |
| `services/geminiService.ts` | 383-445 | `getAI()` 函数：从 gatewayConfig.models 查找网关节点 | 图像模型查不到 |
| `services/geminiService.ts` | 1109 | `shouldUseThirdPartyFormat = node && node.url && (...)` | node 为 null 时为 false |
| `services/geminiService.ts` | 1317 | `await ai.models.generateContent(...)` | 使用空 apiKey 的 GoogleGenAI 实例 |
| `config/gateway_config.json` | 11-57 | models 配置 | 仅含5个文本/对话模型，**无任何图像模型** |


### generateImage() 使用的模型 vs 已配置模型对比

| generateImage() 使用的模型 | 用途 | gateway_config.json 中是否存在 |
| --- | --- | --- |
| `gemini-3.1-flash-image-preview` | 默认生图 / FAST模式 / 局部重绘 | **缺失** |
| `gemini-3-pro-image-preview` | 4K+QUALITY / 放大QUALITY | **缺失** |
| `gemini-2.5-flash-image` | 开发者模式（非网关）fallback | **缺失**（预期行为：开发模式需要官方 Key） |


### 为什么聊天正常

聊天通过 `chatStream()` / `sendMessage()` 走的是以下模型，这些**全部有配置**：

- `deepseek-v3.2`（默认） -- 有配置
- `gemini-3-flash-preview` -- 有配置
- `gemini-3-pro-preview` -- 有配置
- `gemini-3.1-flash-lite-preview` -- 有配置

聊天路径：`getAI() -> 找到 ph8 节点 -> shouldUseThirdPartyFormat=true -> fetch(代理URL) -> 后端/Vite代理添加 Authorization 头 -> 成功`

## 实施方案

### 方案：补全 gateway_config.json 的图像模型配置

在 `config/gateway_config.json` 的 `models` 对象中添加 3 个图像生成模型的 ph8 网关配置。每个模型遵循现有配置格式：

```
{
  "provider": "ph8.co",
  "url": "https://ph8.co",
  "remoteModelId": "<与key相同的模型ID>",
  "priority": 100,
  "active": true
}
```

这样当 `getAI()` 查找图像模型时，能够找到 ph8 网关节点，`selectedNode` 不为 null，`shouldUseThirdPartyFormat` 为 true，走 fetch 代理路径（由 Vite 开发代理或 Nginx 生产代理自动注入 PH8_GATEWAY_KEY），绕过 GoogleGenAI 客户端对 API Key 的校验。

### 不需要修改的部分

- `getNextApiKey()` 返回空字符串是**设计如此**（API Key 由后端管理），不需要改
- `geminiService.ts` 的 `generateImage()` 逻辑不需要改动
- `vite.config.ts` 的代理规则已经覆盖了 `/api/ph8` 路径
- `.env.local` 中的 `PH8_GATEWAY_KEY` 已经有值

### 影响范围

仅修改 1 个文件：`config/gateway_config.json`

### 风险评估

- 风险极低：仅增加配置条目，不影响已有功能
- 如果 ph8.co 网关不支持某个图像模型，该特定场景会返回网关错误而非 "API key missing"，便于定位