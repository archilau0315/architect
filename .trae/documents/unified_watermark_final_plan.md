# 统一水印样式方案（最终版）

## 需求

- 图片和视频水印样式统一
- 包含三个元素：Logo、CHIEF IMAGE ARCHITECT、AI生成
- **CHIEF IMAGE ARCHITECT 放在最上方，强制占一行**
- 不影响现有构图

---

## 最终方案：顶部品牌栏 + 右下角水印

### 水印布局

```
┌─────────────────────────────────────────────────┐
│ CHIEF IMAGE ARCHITECT              [Logo]       │ ← 顶部品牌栏
│                                                 │
│                                                 │
│                                                 │
│                                                 │
│                                                 │
│                                                 │
│                                                 │
│                                                 │
│                                                 │
│                                            AI生成│ ← 右下角
└─────────────────────────────────────────────────┘
```

---

## 方案优势

| 优势 | 说明 |
|------|------|
| **品牌展示** | 顶部品牌名醒目，强制占一行 |
| **不遮挡主体** | 品牌名在边缘，不影响画面中心 |
| **AI标识清晰** | 右下角 AI生成 标识明确 |
| **布局平衡** | 顶部和右下角呼应，视觉平衡 |
| **符合惯例** | 类似新闻图片的水印位置 |

---

## 详细样式规范

### 图片水印

```
┌──────────────────────────────────────────────────┐
│                                                  │
│  元素              位置        大小      透明度  │
├──────────────────────────────────────────────────┤
│  CHIEF IMAGE      左上角      宽度2%     40%    │
│  ARCHITECT                                      │
│  Logo             右上角      宽度10%    40%    │
│  AI生成           右下角      宽度1.5%   40%    │
└──────────────────────────────────────────────────┘

颜色：白色
字体：Inter, sans-serif
边距：3%
```

### 视频水印

```
┌──────────────────────────────────────────────────┐
│                                                  │
│  元素              位置        大小      透明度  │
├──────────────────────────────────────────────────┤
│  CHIEF IMAGE      左上角      16px      40%    │
│  ARCHITECT                                      │
│  Logo             右上角      宽度10%    50%    │
│  AI生成           右下角      12px      40%    │
└──────────────────────────────────────────────────┘

颜色：白色
边距：20px
```

---

## 效果预览

### 横版图片/视频

```
┌─────────────────────────────────────────────────────────────────┐
│ CHIEF IMAGE ARCHITECT                              [Logo]       │
│                                                                 │
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
│ CHIEF IMAGE [Logo]  │
│ ARCHITECT           │
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

## 实施步骤

### 步骤1：修改图片水印服务

**文件**：`services/watermarkService.ts`

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

### 步骤2：修改视频水印服务

**文件**：`services/videoWatermarkService.ts`

```typescript
// FFmpeg 滤镜
const filter = `
  [1:v]format=rgba,lutrgb=r=maxval:g=maxval:b=maxval,colorchannelmixer=aa=0.5[logo];
  [0:v][logo]overlay=W-w-20:20,
  drawtext=text='CHIEF IMAGE ARCHITECT':fontsize=16:fontcolor=white@0.4:x=20:y=30,
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
- 水印集中在右下角
- 占用画面较多

### 新方案（顶部+右下角）

```
┌────────────────────────────────────┐
│ CHIEF IMAGE ARCHITECT    [Logo]    │
│                                    │
│                                    │
│                                    │
│                                    │
│                                    │
│                               AI生成│
└────────────────────────────────────┘
```

**优势**：
- 品牌名在顶部，醒目但不遮挡
- Logo 在右上角，平衡布局
- AI生成在右下角，合规标识
- 整体布局更平衡

---

## 总结

| 元素 | 位置 | 作用 |
|------|------|------|
| **CHIEF IMAGE ARCHITECT** | 左上角 | 品牌展示，强制占一行 |
| **Logo** | 右上角 | 品牌识别 |
| **AI生成** | 右下角 | 合规标识 |

三个元素分布在三个角落，形成稳定的视觉三角，既展示了品牌，又完成了合规标识，且不影响画面主体。
