# 统一水印样式方案（最终版）

## 需求

- 图片和视频水印样式统一
- "CHIEF IMAGE ARCHITECT" 放在最上方，强制占一行
- 包含 Logo 和 "AI生成"
- 不影响现有构图

---

## 推荐方案：顶部品牌栏 + 右下角标识

### 水印布局

```
┌─────────────────────────────────────────────────┐
│ CHIEF IMAGE ARCHITECT                     [Logo]│
│                                                 │
│                                                 │
│                                                 │
│                                                 │
│                                                 │
│                                                 │
│                                                 │
│                                                 │
│                                            AI生成│
└─────────────────────────────────────────────────┘
```

---

## 方案优势

| 优势 | 说明 |
|------|------|
| **品牌醒目** | CHIEF IMAGE ARCHITECT 在顶部，一目了然 |
| **不遮挡主体** | 品牌名在边缘，不影响图片主要内容 |
| **布局平衡** | 顶部品牌 + 右下角标识，视觉平衡 |
| **合规清晰** | AI生成在右下角，清晰标识 |

---

## 详细样式规范

### 顶部品牌栏

```
位置：图片/视频顶部
文字：CHIEF IMAGE ARCHITECT
对齐：左对齐
边距：距左边缘 3%，距顶部 3%
大小：图片宽度的 2%
颜色：白色
透明度：40%
字体：Inter, sans-serif
字重：bold
```

### 右上角 Logo

```
位置：右上角
大小：图片宽度的 10%
颜色：白色
透明度：40%
边距：距右边缘 3%，距顶部 2%
```

### 右下角 AI生成

```
位置：右下角
文字：AI生成
对齐：右对齐
边距：距右边缘 3%，距底部 3%
大小：图片宽度的 1.5%
颜色：白色
透明度：40%
字体：Inter, sans-serif
字重：normal
```

---

## 效果预览

### 横版图片/视频

```
┌─────────────────────────────────────────────────────────────────┐
│ CHIEF IMAGE ARCHITECT                                   [Logo] │
│                                                                 │
│                                                                 │
│                                                                 │
│                                                                 │
│                                                                 │
│                                                                 │
│                                                                 │
│                                                                 │
│                                                            AI生成│
└─────────────────────────────────────────────────────────────────┘
```

### 竖版图片/视频

```
┌─────────────────────┐
│ CHIEF IMAGE    [L]  │
│                     │
│                     │
│                     │
│                     │
│                     │
│                     │
│                     │
│                     │
│                     │
│                     │
│                AI生成│
└─────────────────────┘
```

---

## 图片水印实现

```typescript
// 1. 绘制原图
ctx.drawImage(img, 0, 0);

// 2. 顶部品牌名（左上角）
ctx.globalAlpha = 0.4;
ctx.font = `bold ${canvas.width * 0.02}px Inter, sans-serif`;
ctx.fillStyle = "white";
ctx.textAlign = "left";
ctx.fillText("CHIEF IMAGE ARCHITECT", margin, margin + canvas.width * 0.02);

// 3. 右上角 Logo
ctx.drawImage(logo, canvas.width - logoWidth - margin, margin, logoWidth, logoHeight);

// 4. 右下角 AI生成
ctx.font = `${canvas.width * 0.015}px Inter, sans-serif`;
ctx.textAlign = "right";
ctx.fillText("AI生成", canvas.width - margin, canvas.height - margin);
```

---

## 视频水印实现

```typescript
// FFmpeg 滤镜
const filter = `
  [1:v]format=rgba,lutrgb=r=maxval:g=maxval:b=maxval,colorchannelmixer=aa=0.4[logo];
  [0:v][logo]overlay=W-w-20:20,
  drawtext=text='CHIEF IMAGE ARCHITECT':fontsize=16:fontcolor=white@0.4:x=20:y=20,
  drawtext=text='AI生成':fontsize=12:fontcolor=white@0.4:x=W-tw-20:y=H-th-20
`;
```

---

## 与原方案对比

### 原方案（右下角堆叠）

```
┌────────────────────────────────────┐
│                                    │
│                                    │
│                                    │
│              [Logo]                │
│         CHIEF IMAGE                │
│           ARCHITECT                │
│            AI生成                  │
└────────────────────────────────────┘
```

**问题**：
- 右下角占用空间大
- 可能遮挡重要内容
- 信息堆叠不够清晰

### 新方案（顶部品牌 + 右下角标识）

```
┌────────────────────────────────────┐
│ CHIEF IMAGE ARCHITECT       [Logo] │
│                                    │
│                                    │
│                                    │
│                                    │
│                                    │
│                               AI生成│
└────────────────────────────────────┘
```

**优势**：
- 品牌名在顶部，醒目
- Logo 在右上角，平衡
- AI生成在右下角，合规
- 不遮挡主体内容

---

## 实施步骤

### 步骤1：修改图片水印服务

**文件**：`services/watermarkService.ts`

1. 添加顶部品牌名（左上角）
2. 移动 Logo 到右上角
3. 添加右下角 AI生成

### 步骤2：修改视频水印服务

**文件**：`services/videoWatermarkService.ts`

1. 添加顶部品牌名
2. 移动 Logo 到右上角
3. 添加右下角 AI生成

### 步骤3：测试验证

1. 测试不同尺寸图片
2. 测试不同尺寸视频
3. 验证水印不影响主体内容

---

## 总结

| 元素 | 位置 | 作用 |
|------|------|------|
| **CHIEF IMAGE ARCHITECT** | 左上角 | 品牌展示 |
| **Logo** | 右上角 | 品牌识别 |
| **AI生成** | 右下角 | 合规标识 |

三个元素分布在三个角落，形成稳定的视觉三角，既醒目又不遮挡主体内容。
