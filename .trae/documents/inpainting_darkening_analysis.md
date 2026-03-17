# 局部修改成图变暗问题分析

## 可能的原因

### 1. 合成图遮罩颜色影响

**代码位置**：`overlayMaskOnBaseImage` 函数（第76-117行）

```typescript
// 遮罩叠加到底图上，使用 60% 透明度
ctx.globalAlpha = opacity;  // opacity = 0.6
ctx.drawImage(maskImg, 0, 0, baseImg.width, baseImg.height);
```

**问题**：
- 遮罩通常是白色或彩色
- 叠加到底图上会增加亮度
- 但模型可能会"补偿"这个亮度变化，导致成图变暗

### 2. JPEG 压缩质量

**代码位置**：第101行

```typescript
const resultDataUrl = canvas.toDataURL('image/jpeg', 0.92);
```

**问题**：
- 质量 0.92 可能导致轻微的亮度变化
- 但这个影响应该很小

### 3. 模型处理问题

**问题**：
- 模型在处理"合成图 + 语义提示词"时
- 可能无法完美理解"保持原图明暗"的要求
- 即使提示词中明确要求，模型仍可能调整亮度

---

## 解决方案

### 方案1：调整遮罩透明度

将遮罩透明度从 0.6 降低到 0.3，减少对原图的影响：

```typescript
const overlayedImage = await overlayMaskOnBaseImage(baseRefs[0], maskB, 0.3);
```

### 方案2：使用更明确的提示词

强化提示词中关于保持明暗的要求：

```typescript
const semanticInpaintPrompt = `请修改这张图片中【${colorDescription}】的内容：${inpaintInstruction}

【重要要求】
1. 只修改图片中${colorDescription}标记区域的内容，修改内容必须位于原标记位置
2. 图片中其他所有区域必须保持完全不变
3. 不要在最终结果中显示任何标记或遮罩
4. **严格保持原图的色彩和明暗关系，不要改变整体色调、亮度和对比度**
5. 新生成的内容应与周围区域的亮度和色调保持一致
6. 输出一张完整的、自然的图片`;
```

### 方案3：后处理亮度校正

在获取成图后，自动进行亮度校正，使成图与原图的亮度一致。

---

## 建议实施

**优先尝试方案1和方案2**：
1. 降低遮罩透明度到 0.3
2. 强化提示词中的亮度保持要求
