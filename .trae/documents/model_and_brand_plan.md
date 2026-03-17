# 渲染工坊模型优化 & Chat 品牌化回答计划

## 需求分析

### 需求1：渲染工坊模型选择优化
**商业模式下**，除了 4K + QUALITY 模式，其他都用 `gemini-3.1-flash-image-preview`

**当前代码问题**：
- 1K + QUALITY 使用的是 `Nano-Banana`，需要改成 `gemini-3.1-flash-image-preview`

**修改位置**：`geminiService.ts` 第722-725行

### 需求2：Chat 品牌化回答
当用户问"你是谁"或"用的什么模型"时：
- 用"匡形无界"替换厂商名（Google、DeepSeek等）
- 用"Kbitai合成模型"替代原模型名称
- 回答后加一句："我们的理念是：设计有形，科技无界！

**修改位置**：`geminiService.ts` 第277行 `CREATIVE_CONSULTANT` 系统指令

---

## 实施步骤

### 步骤1：修改渲染工坊模型选择逻辑

**修改前**（第722-725行）：
```typescript
// 1K + QUALITY 使用 Nano-Banana
else if (size === "1K" && tier === "QUALITY") {
  model = "Nano-Banana";
}
```

**修改后**：
```typescript
// 1K + QUALITY 也使用 gemini-3.1-flash-image-preview
else if (size === "1K" && tier === "QUALITY") {
  model = "gemini-3.1-flash-image-preview";
}
```

### 步骤2：修改 Chat 系统指令

**修改前**（第277行）：
```typescript
CREATIVE_CONSULTANT: `创意设计顾问。支持多模态分析，协助建筑、产品、艺术及角色设计。`,
```

**修改后**：
```typescript
CREATIVE_CONSULTANT: `你是匡形无界开发的首席图像架构师，你是用户的创意设计顾问。

【品牌回答规则】
1. 当用户问"你是谁"、"你是什么"、"谁开发的你"等问题时：
   - 回答："我是匡形无界开发的首席图像架构师，我是你的创意设计顾问"
   - 禁止提及任何厂商名称（如Google、DeepSeek等）

2. 当用户问"你用的什么模型"、"你的模型是什么"等问题时：
   - 回答："我使用的是Kbitai合成模型"
   - 禁止提及任何原模型名称

3. 回答上述问题后，必须加一句：
   "我们的理念是：设计有形，科技无界！"

4. 然后继续回答用户的其他问题或提供帮助。

支持多模态分析，协助建筑、产品、艺术及角色设计。`,
```

---

## 预期效果

### 渲染工坊模型选择（商业模式）

| 场景 | 修改前 | 修改后 |
|------|--------|--------|
| 4K + QUALITY | gemini-3-pro-image-preview | gemini-3-pro-image-preview（不变） |
| 1K + QUALITY | Nano-Banana | gemini-3.1-flash-image-preview |
| 其他所有情况 | gemini-3.1-flash-image-preview | gemini-3.1-flash-image-preview（不变） |

### Chat 品牌化回答示例

**用户**：你是谁？
**回答**：我是匡形无界开发的首席图像架构师，我是你的创意设计顾问。我们的理念是：设计有形，科技无界！有什么我可以帮助您的吗？

**用户**：你用的什么模型？
**回答**：我使用的是Kbitai合成模型。我们的理念是：设计有形，科技无界！这款模型专为创意设计优化，支持多模态分析...

---

## 修改文件清单

| 文件 | 修改位置 | 修改内容 |
|------|---------|---------|
| geminiService.ts | 第722-725行 | 模型选择逻辑 |
| geminiService.ts | 第277行 | CREATIVE_CONSULTANT 系统指令 |
