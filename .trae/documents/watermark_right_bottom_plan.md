# 统一水印样式方案（最终版）

## 需求

- 水印位置：右下角
- 水印结构：三层垂直排列
  - 上边：CHIEF IMAGE ARCHITECT（占一行，不换行）
  - 中间：Logo
  - 下边：AI生成
- 保证原构图不变

---

## 水印结构

```
┌─────────────────────────────────────────────────┐
│                                                 │
│                                                 │
│                                                 │
│                                                 │
│                                                 │
│                                                 │
│                       ┌─────────────────────┐   │
│                       │ CHIEF IMAGE ARCHITECT│   │
│                       │       [Logo]         │   │
│                       │       AI生成         │   │
│                       └─────────────────────┘   │
└─────────────────────────────────────────────────┘
```

---

## 水印大小建议

### 推荐比例：图片宽度的 12%

| 图片尺寸 | 水印宽度 | 距边缘 |
|---------|---------|--------|
| 4K (3840px) | 460px | 115px |
| 2K (2560px) | 307px | 77px |
| 1080p (1920px) | 230px | 58px |
| 720p (1280px) | 154px | 38px |

### 水印内部比例

```
┌──────────────────────────────────────────────────┐
│                   水印宽度 = 100%                │
├──────────────────────────────────────────────────┤
│                                                  │
│  CHIEF IMAGE ARCHITECT                           │
│  ├─ 字体大小：水印宽度的 15%                     │
│  ├─ 颜色：白色                                   │
│  └─ 对齐：居中                                   │
│                                                  │
│  [Logo]                                          │
│  ├─ 大小：水印宽度的 60%                         │
│  ├─ 颜色：白色                                   │
│  └─ 对齐：居中                                   │
│                                                  │
│  AI生成                                          │
│  ├─ 字体大小：水印宽度的 12%                     │
│  ├─ 颜色：白色                                   │
│  └─ 对齐：居中                                   │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

## 效果预览

### 横版图片/视频（1920x1080）

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                                                                 │
│                                                                 │
│                                                                 │
│                                                                 │
│                                                                 │
│                                       ┌─────────────────────┐   │
│                                       │ CHIEF IMAGE ARCHITECT│   │
│                                       │        [Logo]        │   │
│                                       │        AI生成        │   │
│                                       └─────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘

水印宽度：1920 × 12% = 230px
距边缘：1920 × 3% = 58px
```

### 竖版图片/视频（1080x1920）

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
│                     │
│                     │
│  ┌────────────────┐ │
│  │CHIEF IMAGE     │ │
│  │ARCHITECT       │ │
│  │    [Logo]      │ │
│  │    AI生成      │ │
│  └────────────────┘ │
└─────────────────────┘

水印宽度：1080 × 12% = 130px
距边缘：1080 × 3% = 32px
```

---

## 图片水印实现

```typescript
// 水印参数
const watermarkWidth = canvas.width * 0.12;  // 水印宽度：图片宽度的 12%
const margin = canvas.width * 0.03;          // 边距：图片宽度的 3%
const padding = watermarkWidth * 0.1;        // 内边距

// 水印位置（右下角）
const watermarkX = canvas.width - watermarkWidth - margin;
const watermarkY = canvas.height - watermarkHeight - margin;

// 1. CHIEF IMAGE ARCHITECT（上边）
ctx.globalAlpha = 0.4;
ctx.font = `bold ${watermarkWidth * 0.15}px Inter, sans-serif`;
ctx.fillStyle = "white";
ctx.textAlign = "center";
ctx.fillText("CHIEF IMAGE ARCHITECT", watermarkX + watermarkWidth/2, watermarkY + padding);

// 2. Logo（中间）
const logoWidth = watermarkWidth * 0.6;
const logoHeight = logoWidth * (logo.height / logo.width);
const logoX = watermarkX + (watermarkWidth - logoWidth) / 2;
const logoY = watermarkY + padding + 20;
ctx.drawImage(logo, logoX, logoY, logoWidth, logoHeight);

// 3. AI生成（下边）
ctx.font = `${watermarkWidth * 0.12}px Inter, sans-serif`;
ctx.fillText("AI生成", watermarkX + watermarkWidth/2, watermarkY + watermarkHeight - padding);
```

---

## 视频水印实现

```typescript
// FFmpeg 滤镜
const filter = `
  [1:v]format=rgba,lutrgb=r=maxval:g=maxval:b=maxval,colorchannelmixer=aa=0.4[logo];
  [0:v][logo]overlay=W-w*0.12-20:H-h-80,
  drawtext=text='CHIEF IMAGE ARCHITECT':fontsize=16:fontcolor=white@0.4:x=W-tw-20:y=H-70,
  drawtext=text='AI生成':fontsize=12:fontcolor=white@0.4:x=W-tw-20:y=H-20
`;
```

---

## 水印大小对比

| 图片尺寸 | 水印宽度 | CHIEF IMAGE ARCHITECT | Logo | AI生成 |
|---------|---------|----------------------|------|--------|
| 4K (3840px) | 460px | 69px | 276px | 55px |
| 2K (2560px) | 307px | 46px | 184px | 37px |
| 1080p (1920px) | 230px | 35px | 138px | 28px |
| 720p (1280px) | 154px | 23px | 92px | 18px |

---

## 实施步骤

### 步骤1：修改图片水印服务

**文件**：`services/watermarkService.ts`

1. 调整水印宽度为图片宽度的 12%
2. CHIEF IMAGE ARCHITECT 居中显示
3. Logo 居中显示
4. AI生成 居中显示

### 步骤2：修改视频水印服务

**文件**：`services/videoWatermarkService.ts`

1. 调整 FFmpeg 滤镜
2. 三层水印居中对齐

### 步骤3：测试验证

1. 测试不同尺寸图片
2. 测试不同尺寸视频
3. 验证水印不影响构图

---

## 总结

| 参数 | 值 |
|------|-----|
| **水印位置** | 右下角 |
| **水印宽度** | 图片宽度的 12% |
| **边距** | 图片宽度的 3% |
| **透明度** | 40% |
| **颜色** | 白色 |

水印结构：CHIEF IMAGE ARCHITECT（上）+ Logo（中）+ AI生成（下），三层居中对齐。
