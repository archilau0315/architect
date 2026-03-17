# 鸟瞰图区域识别与材质约束方案

## 一、需求分析

### 目标
对于鸟瞰图草图，准确区分：
1. **道路** - 车行道、人行道
2. **草坪** - 绿化区域
3. **硬质铺装** - 广场、停车位
4. **建筑轮廓** - 建筑主体

并严格约束其形状，按提示词赋予不同材质、灯光、背景、光线。

---

## 二、技术方案

### 2.1 鸟瞰图区域识别Agent

```typescript
interface AerialViewRegion {
  type: 'road' | 'lawn' | 'paving' | 'building' | 'water' | 'tree';
  contour: Array<{ x: number; y: number }>;  // 轮廓点
  area: number;           // 面积
  shape: string;          // 形状描述
  position: string;       // 位置描述
  material: string;       // 材质建议
}

interface AerialViewAnalysis {
  regions: AerialViewRegion[];
  buildingCount: number;
  roadNetwork: string;    // 道路网络描述
  greenCoverage: number;  // 绿化覆盖率
  hardscapeRatio: number; // 硬质铺装比例
}
```

### 2.2 区域识别规则

| 区域类型 | 特征 | 材质映射 |
|---------|------|---------|
| 道路 | 线性、条状、连接性 | 沥青、混凝土、石材铺装 |
| 草坪 | 不规则形状、大面积 | 草地、景观绿化 |
| 硬质铺装 | 矩形、规则形状 | 石材、砖、混凝土 |
| 建筑 | 矩形、多边形、有阴影 | 混凝土、玻璃、金属 |
| 水体 | 不规则、蓝色调 | 水面、泳池、喷泉 |
| 树木 | 圆形、分散 | 乔木、灌木 |

### 2.3 材质约束模板

```typescript
const MATERIAL_TEMPLATES = {
  road: {
    materials: ['asphalt', 'concrete pavement', 'stone pavers'],
    lighting: 'street lights along edges',
    texture: 'smooth surface with lane markings'
  },
  lawn: {
    materials: ['grass', 'turf', 'landscaping'],
    lighting: 'natural sunlight',
    texture: 'soft green texture'
  },
  paving: {
    materials: ['stone tiles', 'brick pavers', 'concrete'],
    lighting: 'ambient lighting',
    texture: 'patterned surface'
  },
  building: {
    materials: ['concrete', 'glass facade', 'metal panels'],
    lighting: 'architectural lighting',
    texture: 'modern finish'
  }
};
```

---

## 三、实现方案

### 3.1 新增服务：AerialViewAnalysisService

```typescript
export class AerialViewAnalysisService {
  // 分析鸟瞰图
  async analyzeAerialView(imageDataUrl: string): Promise<AerialViewAnalysis>;
  
  // 识别道路网络
  private detectRoadNetwork(imageData: ImageData): AerialViewRegion[];
  
  // 识别绿化区域
  private detectLawnAreas(imageData: ImageData): AerialViewRegion[];
  
  // 识别硬质铺装
  private detectPavingAreas(imageData: ImageData): AerialViewRegion[];
  
  // 识别建筑轮廓
  private detectBuildings(imageData: ImageData): AerialViewRegion[];
  
  // 生成区域约束提示词
  generateRegionConstraints(analysis: AerialViewAnalysis): string;
}
```

### 3.2 形状约束增强

```typescript
interface ShapeConstraint {
  regionType: string;
  contourConstraint: string;    // 轮廓约束
  edgeConstraint: string;       // 边缘约束
  materialConstraint: string;   // 材质约束
  lightingConstraint: string;   // 灯光约束
}

function generateShapeConstraints(region: AerialViewRegion): ShapeConstraint {
  return {
    regionType: region.type,
    contourConstraint: `Maintain exact contour shape of ${region.type}`,
    edgeConstraint: `Keep edges sharp and well-defined`,
    materialConstraint: `Apply ${region.material} texture`,
    lightingConstraint: `Add appropriate lighting for ${region.type}`
  };
}
```

### 3.3 提示词模板

```typescript
const AERIAL_VIEW_PROMPT_TEMPLATE = `
【AERIAL VIEW REGION ANALYSIS - STRICTLY FOLLOW】

【ROAD NETWORK】
- Contours: Must maintain exact road shapes
- Materials: Asphalt/concrete with lane markings
- Lighting: Street lights along edges
- Constraint: Do NOT change road layout

【LAWN/GREEN AREAS】
- Contours: Maintain organic shapes
- Materials: Green grass, landscaping
- Lighting: Natural sunlight
- Constraint: Keep green coverage ratio

【HARDSCAPE/PAVING】
- Contours: Maintain geometric shapes
- Materials: Stone tiles, brick pavers
- Lighting: Ambient lighting
- Constraint: Preserve paving patterns

【BUILDINGS】
- Contours: Maintain building footprints exactly
- Materials: As specified in style prompt
- Lighting: Architectural lighting
- Constraint: Keep building positions and sizes

【DEPTH ORDER】
1. Buildings (highest)
2. Trees/vegetation
3. Roads/paving
4. Lawn (ground level)

【LIGHTING & ATMOSPHERE】
${lightingPrompt}

【STYLE】
${userPrompt}
`;
```

---

## 四、集成方案

### 4.1 修改 geminiService.ts

```typescript
// 检测是否为鸟瞰图
const isAerialView = await this.detectAerialView(baseRefs[0]);

if (isAerialView) {
  // 使用鸟瞰图专用分析
  const aerialAnalysis = await aerialViewAnalysisService.analyzeAerialView(baseRefs[0]);
  
  // 生成区域约束
  const regionConstraints = aerialViewAnalysisService.generateRegionConstraints(aerialAnalysis);
  
  // 整合到提示词
  enhancedPrompt = `${regionConstraints}\n\n${userPrompt}`;
}
```

### 4.2 鸟瞰图检测

```typescript
async detectAerialView(imageDataUrl: string): Promise<boolean> {
  // 使用Gemini Vision判断是否为鸟瞰图
  const analysis = await sketchAnalysisService.analyze(imageDataUrl);
  
  return analysis.layout?.perspective?.toLowerCase().includes('bird') ||
         analysis.layout?.perspective?.toLowerCase().includes('aerial') ||
         analysis.layout?.perspective?.toLowerCase().includes('鸟瞰');
}
```

---

## 五、代码结构

### 新增文件

```
services/
└── aerialViewAnalysisService.ts   # 鸟瞰图分析服务
```

### 修改文件

```
services/
└── geminiService.ts               # 集成鸟瞰图分析
```

---

## 六、实施步骤

### 第一阶段：鸟瞰图分析

1. **创建 AerialViewAnalysisService**
   - 实现区域识别算法
   - 实现道路网络检测
   - 实现建筑轮廓提取

2. **实现区域约束生成**
   - 轮廓约束
   - 材质约束
   - 灯光约束

### 第二阶段：集成

3. **集成到 geminiService.ts**
   - 添加鸟瞰图检测
   - 整合区域约束

4. **测试验证**
   - 测试鸟瞰图渲染
   - 验证区域遵循度

---

## 七、预期效果

### 输入
```
鸟瞰图草图：包含道路、草坪、建筑轮廓
提示词：现代风格，黄昏光线
```

### 输出
```
【AERIAL VIEW ANALYSIS】
- Roads: 3 segments detected
- Lawn: 45% coverage
- Buildings: 2 structures
- Paving: 15% coverage

【CONSTRAINTS APPLIED】
- Road contours preserved
- Lawn shapes maintained
- Building footprints exact
- Lighting: sunset atmosphere
```

---

## 八、关键技术点

1. **区域识别**
   - 基于颜色/纹理的区域分割
   - 形状分析（线性、矩形、不规则）
   - 连通区域分析

2. **轮廓约束**
   - 提取轮廓点
   - 生成轮廓约束提示词
   - 强制保持形状

3. **材质映射**
   - 区域类型 → 材质类型
   - 材质参数（纹理、反射、粗糙度）

4. **灯光约束**
   - 区域类型 → 灯光类型
   - 时间/天气参数
