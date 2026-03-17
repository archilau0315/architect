# 底图轮廓遵循问题解决方案

## 一、问题分析

### 现象描述
- 底图是一整栋建筑的线稿
- 成图只显示建筑的局部（如底部）
- 底稿轮廓关系没有被正确遵循

### 根本原因

1. **提示词不够精确**
   - 当前只传递了结构化描述
   - 没有明确强调"完整构图"和"比例关系"

2. **缺少构图约束Agent**
   - 没有验证生成结果是否符合底图
   - 没有迭代优化机制

3. **尺寸/比例参数问题**
   - 可能没有正确传递底图的宽高比
   - Gemini可能自动裁剪了图像

---

## 二、解决方案架构

### 多Agent协作架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        Agent 编排层                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │ 线稿分析Agent │ ─→ │ 构图约束Agent │ ─→ │ 验证优化Agent │      │
│  │ (Analysis)   │    │ (Constraint) │    │ (Validation) │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                   │                   │               │
│         ▼                   ▼                   ▼               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │ 结构化JSON   │    │ 约束提示词   │    │ 相似度评分   │      │
│  │ 建筑元素     │    │ 构图要求     │    │ 迭代建议     │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────┐
                    │ Gemini 生图  │
                    └──────────────┘
```

---

## 三、新增Agent设计

### 3.1 构图约束Agent (CompositionConstraintAgent)

**职责：** 基于线稿分析结果，生成强约束提示词

**输入：**
- 线稿分析结果 (SketchAnalysis)
- 原始底图尺寸 (width, height)
- 用户提示词

**输出：**
- 强约束提示词
- 构图要求参数

**核心逻辑：**
```typescript
interface CompositionConstraint {
  // 完整性约束
  completenessConstraint: string;
  
  // 比例约束
  aspectRatioConstraint: string;
  
  // 视角约束
  perspectiveConstraint: string;
  
  // 边界约束
  boundaryConstraint: string;
}

function generateConstraints(
  analysis: SketchAnalysis,
  imageSize: { width: number, height: number }
): CompositionConstraint {
  return {
    completenessConstraint: `CRITICAL: Generate the COMPLETE building as shown in the sketch. Do NOT crop or zoom in. The output must show the entire structure from top to bottom.`,
    
    aspectRatioConstraint: `The output image MUST maintain the exact aspect ratio of the input sketch (${imageSize.width}x${imageSize.height}). Do not change the composition.`,
    
    perspectiveConstraint: `Maintain the ${analysis.layout.perspective} perspective. The building should appear in the same view angle as the sketch.`,
    
    boundaryConstraint: `All elements must fit within the frame. The building top, bottom, left and right edges must all be visible in the output.`
  };
}
```

### 3.2 验证优化Agent (ValidationOptimizationAgent)

**职责：** 验证生成结果是否符合底图，提供迭代建议

**输入：**
- 原始底图
- 生成结果图
- 线稿分析结果

**输出：**
- 相似度评分 (0-100)
- 问题诊断
- 迭代建议

**核心逻辑：**
```typescript
interface ValidationResult {
  score: number;           // 相似度评分
  issues: string[];        // 问题列表
  suggestions: string[];   // 改进建议
  shouldRetry: boolean;    // 是否需要重试
}

async function validateResult(
  sketchImage: string,
  generatedImage: string,
  analysis: SketchAnalysis
): Promise<ValidationResult> {
  // 使用 Gemini Vision 对比两张图片
  const comparison = await compareImages(sketchImage, generatedImage);
  
  const issues: string[] = [];
  
  if (comparison.completeness < 0.8) {
    issues.push("生成图像不完整，缺少部分建筑结构");
  }
  
  if (comparison.aspectRatioMatch < 0.9) {
    issues.push("宽高比不匹配，构图被改变");
  }
  
  if (comparison.structureMatch < 0.7) {
    issues.push("结构元素位置不匹配");
  }
  
  return {
    score: comparison.overallScore,
    issues,
    suggestions: generateSuggestions(issues),
    shouldRetry: issues.length > 0
  };
}
```

---

## 四、增强提示词模板

### 4.1 强约束提示词模板

```typescript
const ENHANCED_PROMPT_TEMPLATE = `
【CRITICAL COMPOSITION REQUIREMENTS】

1. COMPLETENESS: Generate the COMPLETE structure shown in the reference sketch.
   - The output MUST show the ENTIRE building from top to bottom
   - Do NOT crop, zoom in, or show only a portion
   - All edges of the building must be visible

2. ASPECT RATIO: Maintain the exact aspect ratio of the input sketch
   - Input dimensions: {width}x{height}
   - Output must have the same proportions
   - Do not stretch or compress the image

3. STRUCTURAL ALIGNMENT: Follow the sketch outline precisely
   - Building type: {buildingType}
   - Number of floors: {floors}
   - All structural elements must be in their exact positions

4. PERSPECTIVE: Maintain the original perspective
   - View angle: {perspective}
   - Do not change the camera position

【BUILDING DETAILS】
{structureDescription}

【STYLE REQUIREMENTS】
{userPrompt}

【ABSOLUTE CONSTRAINTS】
- Output image size: {width}x{height} (or proportional)
- Show the COMPLETE building, not a cropped section
- Preserve all outline relationships from the sketch
`;
```

### 4.2 尺寸传递策略

```typescript
// 确保尺寸参数正确传递给 Gemini
const generationConfig = {
  // 方式1：使用 aspectRatio
  aspectRatio: calculateAspectRatio(width, height), // 如 "3:4", "9:16"
  
  // 方式2：使用 imageSize（Pro模型支持）
  imageSize: `${Math.min(width, maxSize)}x${Math.min(height, maxSize)}`,
  
  // 方式3：使用显式尺寸约束
  outputSize: { width, height }
};
```

---

## 五、实施步骤

### 第一阶段：增强构图约束

1. **创建 CompositionConstraintAgent**
   - 文件：`services/compositionConstraintService.ts`
   - 功能：生成强约束提示词

2. **修改提示词模板**
   - 添加完整性约束
   - 添加宽高比约束
   - 添加边界约束

3. **修改尺寸传递逻辑**
   - 确保宽高比正确传递
   - 确保输出尺寸与输入匹配

### 第二阶段：添加验证机制

4. **创建 ValidationOptimizationAgent**
   - 文件：`services/validationService.ts`
   - 功能：对比底图和成图，给出评分

5. **添加迭代优化流程**
   - 如果验证不通过，自动重试
   - 最多重试2次
   - 每次根据验证结果调整提示词

### 第三阶段：集成测试

6. **集成到现有工作流**
   - 修改 geminiService.ts
   - 添加Agent编排逻辑

7. **测试验证**
   - 测试建筑渲染
   - 测试其他类型生图

---

## 六、代码结构

### 新增文件

```
services/
├── compositionConstraintService.ts  # 构图约束服务
├── validationService.ts             # 验证服务
└── agentOrchestrator.ts             # Agent编排器
```

### 修改文件

```
services/
├── geminiService.ts                 # 集成Agent流程
└── promptEnhancerService.ts         # 增强提示词模板
```

---

## 七、预期效果

### 修改前
```
底图：整栋建筑线稿
成图：建筑底部局部（被裁剪）
```

### 修改后
```
底图：整栋建筑线稿
成图：完整建筑渲染图（保持构图）
```

---

## 八、关键改进点

1. **提示词层面**
   - 添加 "COMPLETE"、"ENTIRE"、"FULL" 等强调词
   - 明确禁止裁剪、缩放

2. **参数层面**
   - 正确传递宽高比
   - 使用 aspectRatio 参数

3. **流程层面**
   - 添加验证环节
   - 支持迭代优化

4. **架构层面**
   - 多Agent协作
   - 分工明确
