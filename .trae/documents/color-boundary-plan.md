# 颜色边界提取与形状约束方案

## 一、需求分析

### 目标
加强对于底图中不同颜色的理解，提取其边界，约束其形状。

### 应用场景
- **建筑渲染工作流**：语义分割图（彩色区域标记）
- **普通生图**：有底图时，需要理解底图的颜色和形状

---

## 二、技术路线

### 方案概述

```
底图（彩色） → Gemini Vision分析 → 颜色边界提取 → 形状约束生成 → 增强提示词 → Gemini生图
```

### 技术栈
1. **Gemini Vision API** - 图像理解和颜色检测
2. **Color Boundary Extraction** - 提取颜色区域的边界
3. **Shape Constraint** - 基于边界生成形状约束
4. **Prompt Enhancement** - 整合颜色和形状约束

---

## 三、实现方案

### 阶段1：颜色边界提取Agent

#### 1.1 颜色边界检测

使用 Gemini Vision API 检测图像中的颜色区域和边界：

```typescript
interface ColorRegion {
  colorName: string;        // 颜色名称（红、绿、蓝等）
  colorHex: string;         // 颜色十六进制值
  boundaries: Array<{     // 边界点列表
    x: number;
    y: number;
  }>;
  area: string;           // 区域描述（墙面、地面、天空等）
  shape: string;           // 形状描述（矩形、多边形、不规则）
  position: string;        // 位置描述
}

interface ColorBoundaryAnalysis {
  regions: ColorRegion[];
  dominantColors: Array<{
    colorName: string;
    percentage: number;
  }>;
  overallColorScheme: string;
}
```

#### 1.2 结构化输出配置

```typescript
const COLOR_BOUNDARY_SCHEMA = {
  type: "object",
  properties: {
    regions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          colorName: { type: "string" },
          colorHex: { type: "string" },
          boundaries: {
            type: "array",
            items: {
              type: "object",
              properties: {
                x: { type: "number" },
                y: { type: "number" }
              }
            }
          },
          area: { type: "string" },
          shape: { type: "string" },
          position: { type: "string" }
        }
      }
    },
    dominantColors: {
      type: "array",
      items: {
        type: "object",
        properties: {
          colorName: { type: "string" },
          percentage: { type: "number" }
        }
      }
    },
    overallColorScheme: { type: "string" }
  },
  required: ["regions", "dominantColors", "overallColorScheme"]
};
```

### 阶段2：形状约束生成

#### 2.1 形状约束模板

基于颜色边界生成形状约束：

```typescript
interface ShapeConstraint {
  regionConstraint: string;
  boundaryConstraint: string;
  shapeConstraint: string;
}

function generateShapeConstraints(regions: ColorRegion[]): ShapeConstraint {
  return {
    regionConstraint: `Each color region must maintain its defined boundaries and shape.`,
    boundaryConstraint: `Do not mix colors across regions. Keep sharp, clean boundaries.`,
    shapeConstraint: `Preserve geometric shape of each color region. Do not blur or distort edges.`
  };
}
```

### 阶段3：提示词增强

#### 3.1 整合颜色和形状约束

```typescript
function buildColorShapePrompt(
  colorAnalysis: ColorBoundaryAnalysis,
  userPrompt: string
): string {
  const regionDescriptions = colorAnalysis.regions.map(region => 
    `- ${region.colorName} region (${region.area}): ${region.shape} at ${region.position}`
  ).join('\n');
  
  return `
【COLOR REGION ANALYSIS - MUST FOLLOW】

${regionDescriptions}

【COLOR MAPPING - MATERIAL ASSIGNMENT】
${generateMaterialMapping(colorAnalysis)}

【SHAPE CONSTRAINTS - BOUNDARY RULES】
1. Each color region must maintain its exact boundaries
2. Do not allow color bleeding or mixing between regions
3. Keep edges sharp and well-defined
4. Preserve geometric shapes (rectangular, polygonal, etc.)

【STYLE】
${userPrompt}

【ABSOLUTE COLOR CONSTRAINTS】
- Follow the color-to-material mapping exactly
- Maintain region boundaries as defined
- Do not introduce new colors outside the defined palette
- Keep color regions distinct and separate`;
}

function generateMaterialMapping(analysis: ColorBoundaryAnalysis): string {
  const mapping: string[] = [];
  
  const materialMap: Record<string, string> = {
    'red': 'brick wall, concrete, stone facade',
    'pink': 'brick wall, concrete, stone facade',
    'green': 'grass, vegetation, landscaping',
    'blue': 'sky, water, glass curtain wall',
    'yellow': 'wood, timber, ground paving',
    'orange': 'wood, timber, ground paving',
    'purple': 'metal, steel, roof material',
    'white': 'concrete, plaster, stone',
    'gray': 'concrete, stone, asphalt',
    'black': 'shadow, dark areas, void'
  };
  
  analysis.regions.forEach(region => {
    const colorKey = region.colorName.toLowerCase();
    const material = materialMap[colorKey] || 'generic material';
    mapping.push(`${region.colorName} → ${material}`);
  });
  
  return mapping.join('\n');
}
```

---

## 四、代码结构

### 新增文件

```
services/
├── colorBoundaryService.ts       # 颜色边界提取服务
└── shapeConstraintService.ts      # 形状约束服务
```

### 修改文件

```
services/
├── geminiService.ts             # 集成颜色边界分析
└── compositionConstraintService.ts # 整合颜色和形状约束
```

---

## 五、实施步骤

### 第一阶段：颜色边界提取

1. **创建 ColorBoundaryService**
   - 文件：`services/colorBoundaryService.ts`
   - 功能：使用 Gemini Vision 提取颜色边界

2. **实现结构化输出**
   - 使用 responseSchema 强制 JSON 格式
   - 提取颜色区域、边界、形状信息

### 第二阶段：形状约束生成

3. **创建 ShapeConstraintService**
   - 文件：`services/shapeConstraintService.ts`
   - 功能：基于颜色边界生成形状约束

4. **更新提示词模板**
   - 整合颜色映射
   - 添加边界约束

### 第三阶段：集成测试

5. **集成到现有工作流**
   - 修改 geminiService.ts
   - 在建筑渲染工作流中调用颜色边界分析

6. **测试验证**
   - 测试语义分割图
   - 测试普通底图

---

## 六、预期效果

### 修改前
```
语义分割图：彩色区域标记
成图：颜色区域模糊，边界不清晰
```

### 修改后
```
语义分割图：彩色区域标记
分析结果：红区域=砖墙，绿区域=草地
成图：颜色区域清晰，边界锐利，材质准确
```

---

## 七、关键改进点

1. **颜色检测**
   - 精确识别颜色区域
   - 提取边界坐标
   - 计算颜色占比

2. **形状约束**
   - 保持区域边界
   - 防止颜色混合
   - 保持几何形状

3. **材质映射**
   - 颜色到材质的映射
   - 明确的材质分配规则

4. **提示词增强**
   - 整合颜色和形状约束
   - 添加边界规则
   - 强调颜色分离
