# 线稿增强与材质边界提取方案

## 一、需求分析

### 目标
1. 加强草图中不同材质边界线稿的提取
2. 生成的图严格按草图的初始材质、颜色、形状、前后关系
3. 增加线稿增强函数，转换为高对比度黑白图

### 核心思路
**高对比度黑白图** → 突出边界线条 → Gemini更容易识别和遵循

---

## 二、技术方案

### 2.1 线稿增强函数

使用 Canvas API 进行图像处理：

```typescript
interface SketchEnhancementOptions {
  contrast: number;      // 对比度增强 (1.0-3.0)
  brightness: number;    // 亮度调整 (-100 to 100)
  threshold: number;     // 二值化阈值 (0-255)
  edgeEnhance: boolean;  // 是否增强边缘
  invert: boolean;       // 是否反转颜色
}

// 默认配置
const DEFAULT_OPTIONS: SketchEnhancementOptions = {
  contrast: 2.0,         // 高对比度
  brightness: 0,         // 保持亮度
  threshold: 128,        // 中间阈值
  edgeEnhance: true,     // 增强边缘
  invert: false          // 不反转
};
```

### 2.2 图像处理流程

```
原始线稿 → 灰度转换 → 对比度增强 → 边缘检测 → 二值化 → 高对比度黑白图
```

### 2.3 处理算法

#### 灰度转换
```typescript
gray = 0.299 * R + 0.587 * G + 0.114 * B
```

#### 对比度增强
```typescript
contrasted = (pixel - 128) * contrast + 128
```

#### 边缘检测（Sobel算子）
```typescript
Gx = [-1, 0, 1; -2, 0, 2; -1, 0, 1]
Gy = [-1, -2, -1; 0, 0, 0; 1, 2, 1]
edge = sqrt(Gx² + Gy²)
```

#### 二值化
```typescript
binary = pixel > threshold ? 255 : 0
```

---

## 三、实现方案

### 3.1 新增服务：SketchEnhancementService

```typescript
export class SketchEnhancementService {
  // 主增强函数
  async enhanceSketch(
    imageDataUrl: string,
    options: SketchEnhancementOptions
  ): Promise<string>;
  
  // 灰度转换
  private toGrayscale(imageData: ImageData): ImageData;
  
  // 对比度增强
  private enhanceContrast(imageData: ImageData, contrast: number): ImageData;
  
  // 边缘检测（Sobel算子）
  private detectEdges(imageData: ImageData): ImageData;
  
  // 二值化
  private binarize(imageData: ImageData, threshold: number): ImageData;
  
  // 材质边界提取
  private extractMaterialBoundaries(imageData: ImageData): ImageData;
}
```

### 3.2 材质边界提取增强

```typescript
interface MaterialBoundary {
  materialId: string;
  boundary: Array<{ x: number; y: number }>;
  color: string;
  depth: number;  // 前后关系（深度）
}

export class MaterialBoundaryExtractor {
  // 提取材质边界
  async extractBoundaries(sketchImage: string): Promise<MaterialBoundary[]>;
  
  // 分析前后关系
  private analyzeDepthOrder(boundaries: MaterialBoundary[]): MaterialBoundary[];
  
  // 生成深度约束提示词
  generateDepthConstraintPrompt(boundaries: MaterialBoundary[]): string;
}
```

---

## 四、集成方案

### 4.1 修改建筑渲染工作流

```typescript
if (isArchitecturalRendering) {
  // 1. 增强线稿（转换为高对比度黑白图）
  const enhancedSketch = await sketchEnhancementService.enhanceSketch(
    baseRefs[0],
    { contrast: 2.0, edgeEnhance: true }
  );
  
  // 2. 提取材质边界
  const materialBoundaries = await materialBoundaryExtractor.extractBoundaries(enhancedSketch);
  
  // 3. 分析语义分割图的颜色边界
  const colorBoundaries = await colorBoundaryService.analyze(baseRefs[1]);
  
  // 4. 生成约束提示词（包含深度关系）
  const constraintPrompt = buildFullConstraintPrompt(
    materialBoundaries,
    colorBoundaries,
    userPrompt
  );
  
  // 5. 发送增强后的线稿
  parts.push({ text: constraintsPrompt });
  parts.push({ text: "增强线稿（高对比度黑白）：" });
  parts.push({ inlineData: { mimeType: "image/jpeg", data: enhancedSketch } });
  parts.push({ text: "语义分割图：" });
  parts.push({ inlineData: { mimeType: "image/jpeg", data: segmentationData } });
}
```

### 4.2 前后关系约束

```typescript
function generateDepthConstraintsPrompt(boundaries: MaterialBoundary[]): string {
  const sortedByDepth = boundaries.sort((a, b) => a.depth - b.depth);
  
  return `【DEPTH ORDER - FRONT TO BACK】
${sortedByDepth.map((b, i) => 
  `${i + 1}. ${b.materialId} (depth: ${b.depth})`
).join('\n')}

【DEPTH CONSTRAINTS】
- Elements with lower depth numbers appear IN FRONT
- Elements with higher depth numbers appear BEHIND
- Maintain proper occlusion relationships
- Do not change the depth ordering`;
}
```

---

## 五、代码结构

### 新增文件

```
services/
├── sketchEnhancementService.ts    # 线稿增强服务
└── materialBoundaryExtractor.ts   # 材质边界提取服务
```

### 修改文件

```
services/
└── geminiService.ts               # 集成线稿增强流程
```

---

## 六、实施步骤

### 第一阶段：线稿增强

1. **创建 SketchEnhancementService**
   - 实现灰度转换
   - 实现对比度增强
   - 实现边缘检测（Sobel算子）
   - 实现二值化

2. **测试增强效果**
   - 测试不同对比度参数
   - 测试边缘检测效果
   - 测试二值化阈值

### 第二阶段：材质边界提取

3. **创建 MaterialBoundaryExtractor**
   - 提取材质边界
   - 分析前后关系（深度）
   - 生成深度约束提示词

4. **集成到工作流**
   - 修改 geminiService.ts
   - 添加增强线稿传递

### 第三阶段：优化迭代

5. **优化参数**
   - 调整对比度参数
   - 调整边缘检测参数
   - 调整二值化阈值

6. **测试验证**
   - 测试建筑渲染
   - 验证边界遵循度

---

## 七、预期效果

### 处理前
```
原始线稿：灰色背景，线条模糊
Gemini识别：边界不清晰，容易忽略细节
```

### 处理后
```
增强线稿：纯白背景，黑色线条清晰锐利
Gemini识别：边界清晰，容易遵循
```

---

## 八、技术细节

### 8.1 Canvas 图像处理

```typescript
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');

const img = new Image();
img.src = imageDataUrl;
await img.decode();

canvas.width = img.width;
canvas.height = img.height;
ctx.drawImage(img, 0, 0);

const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
const pixels = imageData.data;

for (let i = 0; i < pixels.length; i += 4) {
  const r = pixels[i];
  const g = pixels[i + 1];
  const b = pixels[i + 2];
  
  // 灰度转换
  const gray = 0.299 * r + 0.587 * g + 0.114 * b;
  
  // 对比度增强
  const contrasted = (gray - 128) * contrast + 128;
  
  // 二值化
  const binary = contrasted > threshold ? 255 : 0;
  
  pixels[i] = pixels[i + 1] = pixels[i + 2] = binary;
}

ctx.putImageData(imageData, 0, 0);
return canvas.toDataURL('image/jpeg', 0.95);
```

### 8.2 Sobel 边缘检测

```typescript
const sobelX = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
const sobelY = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];

for (let y = 1; y < height - 1; y++) {
  for (let x = 1; x < width - 1; x++) {
    let gx = 0, gy = 0;
    
    for (let ky = -1; ky <= 1; ky++) {
      for (let kx = -1; kx <= 1; kx++) {
        const pixel = getPixel(x + kx, y + ky);
        gx += pixel * sobelX[ky + 1][kx + 1];
        gy += pixel * sobelY[ky + 1][kx + 1];
      }
    }
    
    const edge = Math.sqrt(gx * gx + gy * gy);
    setPixel(x, y, edge > threshold ? 255 : 0);
  }
}
```

---

## 九、总结

本方案通过 **线稿增强 + 材质边界提取 + 深度分析** 的技术路线：

1. **线稿增强**：高对比度黑白图，边界清晰
2. **材质边界提取**：精确识别不同材质区域
3. **深度分析**：确定前后关系，生成约束提示词
4. **约束生成**：确保生成图严格遵循原始线稿

**关键技术点：**
- Canvas API 图像处理
- Sobel 边缘检测算法
- 对比度增强算法
- 二值化处理
- 深度排序算法
