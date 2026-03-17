# 统一水印样式方案（完整版）

## 需求

- 图片和视频水印样式统一
- 包含三个元素：Logo、AI生成、CHIEF IMAGE ARCHITECT
- 不影响现有构图

---

## 推荐方案：右下角三层水印

### 水印布局

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
│                       │ CHIEF IMAGE        │    │
│                       │    ARCHITECT       │    │
│                       │     AI生成         │    │
│                       └────────────────────┘    │
└─────────────────────────────────────────────────┘
```

---

## 方案对比

### 方案A：三层垂直排列（推荐）

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

**优点**：
- 信息层次清晰
- 品牌完整展示
- AI 标识明确

**缺点**：
- 占用空间稍大

---

### 方案B：Logo + 双行文字

```
┌────────────────────────────────────┐
│                                    │
│                                    │
│                                    │
│              [Logo]                │
│       CHIEF IMAGE ARCHITECT        │
│            AI生成                  │
└────────────────────────────────────┘
```

**优点**：
- 品牌名称紧凑
- 占用空间适中

**缺点**：
- 文字较长，可能换行

---

### 方案C：Logo + 角标

```
┌────────────────────────────────────┐
│                                    │
│                                    │
│                                    │
│              [Logo]    [AI生成]    │
│       CHIEF IMAGE ARCHITECT        │
└────────────────────────────────────┘
```

**优点**：
- AI 标识醒目
- 布局灵活

**缺点**：
- 不够统一

---

## 最终推荐：方案A（三层垂直排列）

### 样式规范

```
┌──────────────────────────────────────────────────┐
│                                                  │
│  元素          大小          颜色      透明度    │
├──────────────────────────────────────────────────┤
│  Logo         宽度 12%      白色       40%      │
│  CHIEF IMAGE  宽度 1.8%     白色       40%      │
│  ARCHITECT    宽度 1.8%     白色       40%      │
│  AI生成       宽度 1.5%     白色       40%      │
└──────────────────────────────────────────────────┘

位置：右下角
边距：距边缘 3%
行间距：5px
```

---

## 图片水印实现

```typescript
// 水印绘制顺序
// 1. Logo（最上层）
// 2. CHIEF IMAGE ARCHITECT（品牌名）
// 3. AI生成（合规标识）

const logoWidth = canvas.width * 0.12;
const margin = canvas.width * 0.03;
const lineHeight = Math.max(14, canvas.width * 0.018);

// Logo 位置
const logoX = canvas.width - logoWidth - margin;
const logoY = canvas.height - logoHeight - margin - lineHeight * 3;

// CHIEF IMAGE ARCHITECT
ctx.font = `bold ${lineHeight}px Inter, sans-serif`;
ctx.fillText("CHIEF IMAGE", canvas.width - margin, canvas.height - margin - lineHeight * 2);
ctx.fillText("ARCHITECT", canvas.width - margin, canvas.height - margin - lineHeight);

// AI生成
ctx.font = `${lineHeight * 0.8}px Inter, sans-serif`;
ctx.fillText("AI生成", canvas.width - margin, canvas.height - margin);
```

---

## 视频水印实现

```typescript
// FFmpeg 滤镜
const filter = `
  [1:v]format=rgba,lutrgb=r=maxval:g=maxval:b=maxval,colorchannelmixer=aa=0.6[logo];
  [0:v][logo]overlay=W-w-20:H-h-80,
  drawtext=text='CHIEF IMAGE':fontsize=14:fontcolor=white@0.4:x=W-tw-20:y=H-th-50,
  drawtext=text='ARCHITECT':fontsize=14:fontcolor=white@0.4:x=W-tw-20:y=H-th-35,
  drawtext=text='AI生成':fontsize=12:fontcolor=white@0.4:x=W-tw-20:y=H-th-20
`;
```

---

## 效果预览

### 横版图片/视频

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                                                                 │
│                                                                 │
│                                                                 │
│                                                                 │
│                                           ┌──────────────────┐  │
│                                           │      [Logo]      │  │
│                                           │   CHIEF IMAGE    │  │
│                                           │     ARCHITECT    │  │
│                                           │     AI生成       │  │
│                                           └──────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 竖版图片/视频

```
┌─────────────────────┐
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
│          [Logo]     │
│     CHIEF IMAGE     │
│       ARCHITECT     │
│        AI生成       │
└─────────────────────┘
```

---

## 实施步骤

### 步骤1：修改图片水印服务

**文件**：`services/watermarkService.ts`

1. 添加 CHIEF IMAGE ARCHITECT 双行文字
2. 添加 AI生成 文字
3. 调整 Logo 位置

### 步骤2：修改视频水印服务

**文件**：`services/videoWatermarkService.ts`

1. 添加三层文字水印
2. 调整 FFmpeg drawtext 滤镜

### 步骤3：测试验证

1. 测试不同尺寸图片
2. 测试不同尺寸视频
3. 验证水印可读性

---

## 总结

| 元素 | 作用 | 样式 |
|------|------|------|
| **Logo** | 品牌识别 | 图形，白色 40% |
| **CHIEF IMAGE ARCHITECT** | 品牌名称 | 文字，白色 40% |
| **AI生成** | 合规标识 | 文字，白色 40% |

三层水印从上到下排列，形成完整的品牌+合规标识体系。
