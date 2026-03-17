# Logo 大小调整计划

## 需求

将水印中的 Logo 缩小为原来的 0.65 倍。

---

## 当前 Logo 大小

### 图片水印
- Logo 大小：水印宽度的 60%
- 位置：中间，居中

### 视频水印
- Logo 大小：水印宽度的 7.2%（约 60% 的 12%）
- 位置：中间，居中

---

## 修改后 Logo 大小

### 图片水印
- Logo 大小：水印宽度的 39%（60% × 0.65）
- 位置：中间，居中

### 视频水印
- Logo 大小：水印宽度的 4.68%（7.2% × 0.65）
- 位置：中间，居中

---

## 实施步骤

### 步骤1：修改图片水印服务

**文件**：`services/watermarkService.ts`

```typescript
// 修改前
const logoWidth = watermarkWidth * 0.6;

// 修改后
const logoWidth = watermarkWidth * 0.39;  // 60% × 0.65
```

### 步骤2：修改视频水印服务

**文件**：`services/videoWatermarkService.ts`

```typescript
// 修改前
scale=iw*0.072

// 修改后
scale=iw*0.0468  // 7.2% × 0.65
```

---

## 效果对比

| 图片尺寸 | 修改前 Logo 宽度 | 修改后 Logo 宽度 |
|---------|-----------------|-----------------|
| 4K (3840px) | 276px | 179px |
| 2K (2560px) | 184px | 120px |
| 1080p (1920px) | 138px | 90px |
| 720p (1280px) | 92px | 60px |
