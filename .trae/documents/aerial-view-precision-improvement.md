# 鸟瞰图区域识别精度改进方案

## 一、问题分析

### 当前问题
鸟瞰图分析服务对以下区域的理解不准确：
1. **四周道路边界** - 道路轮廓识别不清晰
2. **场地上的硬铺装** - 铺装区域边界模糊
3. **绿化** - 绿化区域识别不精确
4. **灰色的停车场边界** - 停车场边界不清晰
5. **建筑物的轮廓和形状** - 建筑轮廓不准确

### 根本原因

1. **提示词不够详细**
   - 没有强调边界和轮廓的重要性
   - 没有提供足够的颜色识别指导

2. **区域类型细分不足**
   - 道路没有区分主干道、支路、人行道
   - 铺装没有区分广场、步道、停车位
   - 绿化没有区分草坪、树阵、花坛

3. **颜色识别指导不足**
   - 灰色区域可能是道路、铺装、停车场
   - 绿色区域可能是草坪、树木
   - 没有提供颜色到材质的精确映射

---

## 二、改进方案

### 2.1 增强分析提示词

```typescript
const ENHANCED_AERIAL_ANALYSIS_PROMPT = `You are an expert aerial view analyst for architectural site plans. Analyze this aerial view sketch with HIGH PRECISION.

【CRITICAL REQUIREMENTS】
1. Identify EXACT boundaries and contours for each region
2. Distinguish between similar colors (gray could be road, paving, or parking)
3. Trace building outlines precisely
4. Identify road edges and intersections

【REGION TYPES - DETAILED CLASSIFICATION】

ROADS (道路):
- Main roads: wider, usually gray/black, with lane markings
- Secondary roads: narrower, connecting to main roads
- Pedestrian paths: thin lines, often lighter color
- Road edges: clear boundaries with other regions

LAWN/GREEN (绿化):
- Grass areas: solid green, organic shapes
- Tree clusters: darker green, circular/irregular shapes
- Flower beds: defined borders, various colors
- Green boundaries: edges with paving or roads

PAVING (硬铺装):
- Plazas: large rectangular areas, often light gray
- Walkways: linear paths, connecting buildings
- Courtyards: enclosed areas within buildings
- Paving patterns: geometric shapes, clear edges

PARKING (停车场):
- Parking lots: rectangular areas with grid lines
- Usually gray color with white markings
- Located near roads or building entrances
- Clear boundary with surrounding areas

BUILDINGS (建筑):
- Building footprints: precise rectangular/polygonal shapes
- Roof outlines: clear edges, may have texture
- Building shadows: help identify height
- Building entrances: connected to roads/paths

【COLOR TO MATERIAL MAPPING】
- DARK GRAY/BLACK → asphalt road, parking lot
- LIGHT GRAY → concrete paving, plaza
- GREEN → grass, trees, vegetation
- WHITE/LIGHT → building roofs, marked areas
- BROWN → earth, soil, unpaved areas

【OUTPUT REQUIREMENTS】
For each region, provide:
1. Exact type (road_main, road_secondary, lawn, tree, paving_plaza, paving_walkway, parking, building)
2. Precise contour description (number of vertices, edge types)
3. Boundary description (what it borders with)
4. Shape metrics (approximate dimensions if possible)
5. Position relative to other regions

Also provide:
- Total building count with sizes
- Road network layout description
- Green coverage percentage
- Hardscape ratio
- Perspective type`;
```

### 2.2 细化区域类型

```typescript
export interface AerialViewRegion {
  type: 'road_main' | 'road_secondary' | 'road_pedestrian' |
        'lawn' | 'tree_cluster' | 'flower_bed' |
        'paving_plaza' | 'paving_walkway' | 'courtyard' |
        'parking' | 'building' | 'water';
  
  // 新增字段
  subType: string;           // 子类型
  contour: string;           // 轮廓描述
  boundaryWith: string[];    // 与哪些区域相邻
  edgeType: 'straight' | 'curved' | 'mixed';  // 边缘类型
  vertexCount: number;       // 顶点数量（用于形状识别）
  dimensions: {              // 大致尺寸
    width: number;
    height: number;
  };
}
```

### 2.3 颜色识别增强

```typescript
const COLOR_TO_MATERIAL_MAPPING = {
  // 道路相关
  'dark_gray': { type: 'road_main', material: 'asphalt' },
  'medium_gray': { type: 'road_secondary', material: 'concrete' },
  'light_gray_linear': { type: 'road_pedestrian', material: 'pavers' },
  
  // 铺装相关
  'light_gray_rectangular': { type: 'paving_plaza', material: 'stone tiles' },
  'light_gray_narrow': { type: 'paving_walkway', material: 'concrete pavers' },
  
  // 停车场
  'gray_with_grid': { type: 'parking', material: 'asphalt with markings' },
  
  // 绿化相关
  'solid_green': { type: 'lawn', material: 'grass' },
  'dark_green_circular': { type: 'tree_cluster', material: 'trees' },
  'green_with_border': { type: 'flower_bed', material: 'plants' },
  
  // 建筑
  'white_rectangular': { type: 'building', material: 'concrete roof' },
  'light_rectangular': { type: 'building', material: 'metal roof' }
};
```

### 2.4 边界约束增强

```typescript
const BOUNDARY_CONSTRAINT_TEMPLATE = `
【BOUNDARY CONSTRAINTS - STRICTLY FOLLOW】

ROAD BOUNDARIES:
- Road edges must be SHARP and WELL-DEFINED
- Road width must be CONSISTENT throughout
- Road intersections must be clearly marked
- Road boundaries with other regions must be preserved

PAVING BOUNDARIES:
- Paving edges must be STRAIGHT and GEOMETRIC
- Paving patterns must be preserved
- Paving boundaries with lawn must be clear
- Paving boundaries with roads must be distinct

PARKING BOUNDARIES:
- Parking lot edges must be RECTANGULAR
- Parking space markings must be visible
- Parking boundaries with roads must be clear
- Parking boundaries with buildings must be preserved

LAWN BOUNDARIES:
- Lawn edges can be ORGANIC or GEOMETRIC
- Lawn boundaries with paving must be sharp
- Lawn boundaries with roads must be clear
- Lawn shapes must be preserved exactly

BUILDING BOUNDARIES:
- Building footprints must be EXACT
- Building edges must be STRAIGHT
- Building corners must be SHARP (90° or as shown)
- Building boundaries with all other regions must be preserved
`;
```

---

## 三、实施步骤

### 第一阶段：增强提示词

1. **更新 AERIAL_ANALYSIS_PROMPT**
   - 添加详细的区域类型分类
   - 添加颜色到材质的映射
   - 强调边界和轮廓的重要性

2. **更新分析结果结构**
   - 添加 subType 字段
   - 添加 boundaryWith 字段
   - 添加 edgeType 字段

### 第二阶段：增强约束生成

3. **更新 generateRegionConstraints 方法**
   - 为每种区域类型生成专门的边界约束
   - 添加边缘类型约束
   - 添加相邻区域约束

4. **添加颜色识别指导**
   - 在提示词中添加颜色识别规则
   - 区分相似颜色（灰色可能是道路、铺装、停车场）

### 第三阶段：集成测试

5. **测试验证**
   - 测试道路边界识别
   - 测试铺装边界识别
   - 测试停车场边界识别
   - 测试建筑轮廓识别

---

## 四、代码修改

### 修改文件

```
services/
└── aerialViewAnalysisService.ts   # 增强分析提示词和约束生成
```

### 主要修改点

1. **AERIAL_ANALYSIS_PROMPT** - 增强分析提示词
2. **AerialViewRegion 接口** - 添加新字段
3. **generateRegionConstraints 方法** - 增强约束生成
4. **MATERIAL_MAPPING** - 添加更多材质类型

---

## 五、预期效果

### 修改前
```
道路边界模糊
铺装区域不清晰
停车场边界不明确
建筑轮廓不准确
```

### 修改后
```
道路边界清晰锐利
铺装区域边界明确
停车场边界精确
建筑轮廓准确
```

---

## 六、关键改进点

1. **提示词层面**
   - 添加详细的区域类型分类
   - 强调边界和轮廓的重要性
   - 添加颜色识别指导

2. **数据结构层面**
   - 细化区域类型
   - 添加边界相邻信息
   - 添加边缘类型

3. **约束生成层面**
   - 为每种区域类型生成专门约束
   - 强调边界保持
   - 强调形状保持
