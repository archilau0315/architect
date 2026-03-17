# 统一水印样式方案（最终版）

## 需求

- 水印位置：整图右下角
- 水印结构：
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

### 方案A：固定比例（推荐）

```
水印宽度：图片宽度的 12%
水印高度：自适应（根据内容）

元素比例：
┌────────────────────────────────────────┐
│ 元素                    相对大小        │
├────────────────────────────────────────┤
│ CHIEF IMAGE ARCHITECT   水印宽度的 100% │
│ Logo                    水印宽度的 60%  │
│ AI生成                  水印宽度的 50%  │
└────────────────────────────────────────┘
```

**优点**：
- 自动适应不同尺寸图片
- 大小适中，不影响构图

### 方案B：固定像素

```
水印宽度：150px（大图）/ 100px（中图）/ 60px（小图）
水印高度：自适应

元素大小：
- CHIEF IMAGE ARCHITECT：12px
- Logo：80px（大图）/ 50px（小图）
- AI生成：10px
```

**优点**：
- 文字清晰可读
- 固定大小，一致性好

---

## 推荐方案：固定比例

### 详细样式规范

```
┌──────────────────────────────────────────────────┐
│                                                  │
│  水印整体                                        │
│  ├─ 宽度：图片宽度的 12%                         │
│  ├─ 位置：右下角，距边缘 3%                      │
│  └─ 透明度：40%                                  │
│                                                  │
│  CHIEF IMAGE ARCHITECT                           │
│  ├─ 字体大小：水印宽度的 15%                     │
│  ├─ 颜色：白色                                   │
│  ├─ 对齐：居中                                   │
│  └─ 字重：bold                                   │
│                                                  │
│  Logo                                            │
│  ├─ 大小：水印宽度的 60%                         │
│  ├─ 颜色：白色                                   │
│  └─ 对齐：居中                                   │
│                                                  │
│  AI生成                                          │
│  ├─ 字体大小：水印宽度的 12%                     │
│  ├─ 颜色：白色                                   │
│  ├─ 对齐：居中                                   │
│  └─ 字重：normal                                 │
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
const watermarkWidth = 'W*0.12';  // 视频宽度的 12%
const margin = 'W*0.03';          // 边距

const filter = `
  [1:v]format=rgba,lutrgb=r=maxval:g=maxval:b=maxval,colorchannelmixer=aa=0.4,scale=iw*0.6:-1[logo];
  [0:v][logo]overlay=W-w-${margin}:H-h-${margin}-30,
  drawtext=text='CHIEF IMAGE ARCHITECT':fontsize=h*0.02:fontcolor=white@0.4:x=W-tw-${margin}:y=H-th-${margin}-60,
  drawtext=text='AI生成':fontsize=h*0.015:fontcolor=white@0.4:x=W-tw-${margin}:y=H-th-${margin}
`;
```

---

## 水印大小对比

| 图片尺寸 | 水印宽度 | CHIEF IMAGE ARCHITECT | Logo | AI生成 |
|---------|---------|----------------------|------|--------|
| 4K (3840x2160) | 460px | 69px | 276px | 55px |
| 2K (2560x1440) | 307px | 46px | 184px | 37px |
| 1080p (1920x1080) | 230px | 35px | 138px | 28px |
| 720p (1280x720) | 154px | 23px | 92px | 18px |

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
