# 水印添加"AI生成"标识方案

## 当前水印实现

### 图片水印
- Logo：右下角，白色半透明
- 文字：`Chief Image Architect`

### 视频水印
- Logo：右下角，白色半透明
- 文字：`Chief Image Architect`（Logo 加载失败时）

---

## 需求分析

在不影响现有构图的前提下，添加"AI生成"标识。

---

## 建议方案

### 方案1：双行文字水印（推荐）

```
┌────────────────────────────────────┐
│                                    │
│                                    │
│                                    │
│                                    │
│                                    │
│              ┌─────────────────┐   │
│              │     [Logo]      │   │
│              │    AI 生成      │   │
│              └─────────────────┘   │
└────────────────────────────────────┘
```

**效果**：
- Logo 下方添加"AI生成"文字
- 字体较小，不抢眼
- 白色半透明，与 Logo 风格一致

**优点**：
- 不增加水印占用面积
- 清晰标识 AI 生成
- 不影响构图

---

### 方案2：组合文字水印

```
┌────────────────────────────────────┐
│                                    │
│                                    │
│                                    │
│                                    │
│                                    │
│                                    │
│         Chief Image Architect     │
│              AI 生成               │
└────────────────────────────────────┘
```

**效果**：
- 主文字：`Chief Image Architect`
- 副文字：`AI 生成`

**优点**：
- 纯文字，加载快
- 信息清晰

---

### 方案3：角标式水印

```
┌────────────────────────────────────┐
│ ┌────────┐                         │
│ │AI 生成 │                         │
│ └────────┘                         │
│                                    │
│                                    │
│                                    │
│                                    │
│              [Logo]                │
└────────────────────────────────────┘
```

**效果**：
- 左上角添加"AI生成"角标
- 右下角保留 Logo

**优点**：
- 位置明确，不遮挡主内容
- 符合短视频平台习惯

**缺点**：
- 占用两个角落
- 可能影响构图

---

## 推荐方案：方案1（双行文字水印）

### 图片水印修改

```typescript
// 修改前
ctx.fillText(text, canvas.width - margin, canvas.height - logoHeight - margin - 10);

// 修改后
// 主文字：Chief Image Architect
ctx.fillText(text, canvas.width - margin, canvas.height - logoHeight - margin - 10);
// 副文字：AI 生成
ctx.font = `${Math.max(10, canvas.width * 0.015)}px Inter, sans-serif`;
ctx.fillText("AI 生成", canvas.width - margin, canvas.height - logoHeight - margin + 5);
```

### 视频水印修改

```typescript
// 修改前
drawtext=text='Chief Image Architect':fontsize=24:fontcolor=white@0.5

// 修改后
drawtext=text='Chief Image Architect':fontsize=24:fontcolor=white@0.5:x=W-tw-20:y=H-th-40,
drawtext=text='AI 生成':fontsize=16:fontcolor=white@0.5:x=W-tw-20:y=H-th-20
```

---

## 实施步骤

### 步骤1：修改图片水印服务

**文件**：`services/watermarkService.ts`

1. 在 Logo 下方添加"AI生成"文字
2. 调整文字大小和间距

### 步骤2：修改视频水印服务

**文件**：`services/videoWatermarkService.ts`

1. 添加双行文字水印
2. 调整 FFmpeg drawtext 滤镜

### 步骤3：测试验证

1. 生成图片，检查水印效果
2. 生成视频，检查水印效果
3. 确认不影响构图

---

## 水印样式规范

| 元素 | 大小 | 颜色 | 透明度 | 位置 |
|------|------|------|--------|------|
| Logo | 宽度 15% | 白色 | 40% | 右下角 |
| 主文字 | 宽度 2% | 白色 | 30% | Logo 上方 |
| AI生成 | 宽度 1.5% | 白色 | 30% | 主文字下方 |

---

## 效果预览

```
┌─────────────────────────────────────────────────┐
│                                                 │
│                                                 │
│                                                 │
│                                                 │
│                                                 │
│                                                 │
│                       ┌────────────────────┐    │
│                       │      [Logo]        │    │
│                       │ Chief Image        │    │
│                       │    Architect       │    │
│                       │     AI 生成        │    │
│                       └────────────────────┘    │
└─────────────────────────────────────────────────┘
```
