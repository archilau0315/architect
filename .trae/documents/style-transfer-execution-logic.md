# 风格迁移系统 - 执行逻辑与效果说明

## 一、功能概述

**核心目标**：当用户同时上传基础图像（Base References）和风格参考图像（Slot C 视觉基因）时，系统自动启用**智能风格迁移模式**，无需用户手动切换或点击新按钮。

***

## 二、触发条件（自动检测）

```typescript
const shouldUseStyleTransfer = 
  !isCompositeMode &&           // 非资产重组模式
  baseRefs.length > 0 &&        // 存在基础图像
  styleRefs.length > 0 &&       // 存在风格参考图像
  !isInpaintMode;               // 非局部重绘模式
```

**触发时机**：用户点击"执行渲染"按钮时，`handleGenerate()` 函数内部自动检测。

***

## 三、完整执行流程

### 阶段1：图像加载与预处理（并行）

```
┌─────────────────────┐     ┌─────────────────────┐
│   基础图像 (Base)    │     │  参考图像 (Style C)  │
│                     │     │                     │
│  ↓ extractSubject() │     │  ↓ extractStyle()   │
│                     │     │                     │
│  • Sobel边缘检测     │     │  • 材质分析          │
│  • 线条艺术生成      │     │  • 色彩方案提取      │
│  • 体积/深度图计算   │     │  • 光照条件分析      │
│  • 轮廓/边界框检测   │     │  • 氛围质量评估      │
│  • 构图特征分析      │     │  • 艺术风格识别      │
└─────────┬───────────┘     └─────────┬───────────┘
          │                           │
          └───────────┬───────────────┘
                      ↓
              Promise.all() 等待完成
                      ↓
```

### 阶段2：数据结构化存储

#### Subject JSON（主体结构数据）

```json
{
  "structure": {
    "lineArt": "data:image/png;base64,...",      // 边缘检测结果图
    "volumeMap": "data:image/png;base64,...",     // 深度/体积图
    "contours": [                                  // 检测到的轮廓
      {
        "points": [{"x":100, "y":200}, ...],
        "confidence": 0.85,
        "area": 12500
      }
    ],
    "edges": [                                     // 边缘点集合
      {"x":150, "y":250, "strength":128}
    ]
  },
  "composition": {
    "boundingBoxes": [                              // 物体边界框
      {"x":50, "y":80, "width":300, "height":400}
    ],
    "focalPoints": [                                // 视觉焦点
      {"x":200, "y":300}
    ],
    "perspective": "perspective",                   // flat | perspective | aerial
    "symmetry": 0.72                                // 对称度 0-1
  },
  "metadata": {
    "width": 1024,
    "height": 768,
    "dominantOrientation": "vertical",              // horizontal | vertical | square
    "complexity": 0.65                              // 复杂度 0-1
  }
}
```

#### Style JSON（风格特征数据）

```json
{
  "material": {
    "type": "metallic",                             // matte | glossy | metallic | translucent | textured
    "texture": "rough",                             // smooth | medium-texture | rough
    "roughness": 0.58,                              // 粗糙度 0-1
    "reflectivity": 0.25,                           // 反射率 0-1
    "surfaceDetail": "intricate"                    // uniform | moderate | intricate
  },
  "colorScheme": {
    "dominantColors": [
      {"hex":"#D4A574", "percentage":0.35},
      {"hex":"#2C3E50", "percentage":0.28},
      {"hex":"#8B4513", "percentage":0.18}
    ],
    "accentColors": ["#FFD700", "#800020"],
    "temperature": "warm",                          // warm | cool | neutral
    "saturation": 0.72,                             // 饱和度 0-1
    "brightness": 0.55,                             // 亮度 0-1
    "contrast": 0.68,                               // 对比度 0-1
    "harmony": "complementary"                       // monochromatic | analogous | complementary | triadic
  },
  "lighting": {
    "direction": "top left",                        // 光源方向
    "intensity": 0.68,                              // 光照强度 0-1
    "shadows": "soft",                              // soft | hard | diffused
    "highlights": ["warm-white"],                   // 高光颜色类型
    "ambientLevel": 0.75,                           // 环境光水平
    "keyLightColor": "#FFF5E6",                    // 主光源色温
    "fillLightRatio": 0.07                         // 补光比例
  },
  "atmosphere": {
    "mood": "vibrant, warm, dramatic",              // 情绪标签
    "timeOfDay": "golden-hour",                     // 时间段（可选）
    "weather": "clear",                            // 天气（可选）
    "effects": ["golden-glow", "vignette"],         // 特效列表
    "depth": "medium",                             // 景深 shallow | medium | deep
    "haze": 0.15,                                 // 雾气程度 0-1
    "grain": 0.08                                  // 颗粒感 0-1
  },
  "artisticStyle": "cinematic-hyperrealistic",      // 综合艺术风格
  "brushwork": "photographic-realism"             // 笔触/渲染技法
}
```

### 阶段3：智能提示词构建

生成的提示词结构示例：

```
[STYLE-TRANSFER-MODE]
Preserve the exact structural composition and subject layout from the source image while applying the following stylistic transformation:

## SUBJECT STRUCTURE (retain 60%)
- Composition: vertical orientation, perspective perspective view
- Complexity level: 65% (moderate)
- Symmetry: 72% balanced
- Key structural elements: 12 major forms detected
- Focal point arrangement: 3 visual anchors

## STYLE CHARACTERISTICS (apply 40%)
- Artistic style: cinematic-hyperrealistic
- Material properties: metallic, rough texture, intricate surface detail
- Color scheme: warm palette, complementary harmony, saturation 72%
- Dominant colors: #D4A574, #2C3E50, #8B4513
- Lighting: top left light source, soft shadows, intensity 68%
- Atmosphere: vibrant, warm, dramatic, medium depth of field
- Time of day: golden-hour
- Special effects: golden-glow, vignette
- Rendering technique: photographic-realism

## BLEND MODE: SEAMLESS
Structure preservation priority: HIGH
Detail retention: 80%

## DOMAIN-SPECIFIC GUIDANCE (Architecture)
Maintain architectural integrity: structural lines, load-bearing elements, and spatial relationships must remain geometrically accurate.
Apply style to surface treatments, material rendering, environmental context, and atmospheric perspective only.

## USER DIRECTIVE
{用户的原始输入提示词}
```

### 阶段4：调用图像生成API

```typescript
// 使用增强后的提示词和图像参数调用 GeminiService
const result = await GeminiService.generateImage(
  effectivePrompt,           // 风格迁移增强后的提示词
  effectiveConfig,           // 原始配置参数
  isCompositeMode,           // 保持原有模式判断
  effectiveBaseRefs,        // 基础图像（主体来源）
  slotARefs,                // Slot A（如有）
  slotBRefs,                // Slot B（如有）
  effectiveStyleRefs,       // 风格参考图像（传递给模型）
  maskRefB,                 // 遮罩（如有）
  inpaintPrompt,            // 重绘提示词（如有）
  maskRefA,                 // 遮罩A（如有）
  instructions,             // 系统指令集
  modelConfig,              // 模型配置
  controller.signal,        // 中断信号
  domain,                   // 领域（建筑/产品/艺术）
  baseRefsOriginalSizes     // 原始尺寸信息
);
```

***

## 四、技术实现细节

### 4.1 边缘检测算法（Sobel算子）

```
输入图像 → 灰度转换 → Sobel卷积 → 梯度幅值 → 二值化 → lineArt输出
                                    ↓
                              加权亮度混合 → volumeMap输出
```

**Sobel核矩阵**：

```
水平方向 Gx:          垂直方向 Gy:
[-1, 0, +1]           [-1, -2, -1]
[-2, 0, +2]           [ 0,  0,  0]
[-1, 0, +1]           [+1, +2, +1]

梯度幅值 = √(Gx² + Gy²)
```

### 4.2 材质分析算法

| 特征指标     | 计算方法         | 判定阈值                              |
| -------- | ------------ | --------------------------------- |
| **粗糙度**  | 局部像素方差均值     | >35=rough, >20=medium, <20=smooth |
| **反射率**  | 高亮区域(>220)占比 | >30%=glossy                       |
| **材质类型** | 综合(粗糙度+反射率)  | 见下方决策树                            |

**材质类型决策树**：

```
reflectivity > 0.3 → glossy
roughness > 0.5 AND reflectivity > 0.15 → metallic
roughness > 0.6 → textured
variance > 25 AND reflectivity < 0.1 → translucent
其他 → matte
```

### 4.3 色彩分析算法

**色彩空间转换**（RGB → HSL）：

```typescript
// 亮度 L = (max(R,G,B) + min(R,G,B)) / 2
// 饱和度 S = (max - min) / (L < 0.5 ? max + min : 2 - max - min)
// 色相 H = 根据最大通道计算角度(0°-360°)
```

**色温判定**：

```
主色调在 0°-45° 或 315°-360° → warm（红橙黄系）
主色调在 195°-285° → cool（蓝青紫系）
其他 → neutral
```

### 4.4 光照分析算法

**四象限亮度分析法**：

```
将图像分为4个象限:
┌─────────┬─────────┐
│ top-left │ top-right│
├─────────┼─────────┤
│bot-left │bot-right│
└─────────┴─────────┘

→ 找到最亮象限 → 推断光源方向
```

**阴影硬度判定**：

```
相邻像素亮度差 > 80 的比例:
> 25% → hard shadow
> 12% → soft shadow
< 12% → diffused shadow
```

### 4.5 氛围特效检测

| 特效          | 检测方法       | 判定条件          |
| ----------- | ---------- | ------------- |
| **Bokeh虚化** | 中心vs边缘锐度比  | 中心锐度 > 边缘×2.5 |
| **镜头光晕**    | 高亮像素周围暗区计数 | >3个候选点        |
| **暗角效果**    | 内圈vs外圈亮度比  | 内圈 > 外圈×1.15  |
| **雾气/朦胧**   | 低对比度像素占比   | haze值         |
| **颗粒感**     | 局部噪声方差     | grain值        |

***

## 五、预期效果对比

### 输入示例

| 基础图像（主体）  | 参考图像（风格）    |
| --------- | ----------- |
| 一座现代建筑的照片 | 一幅油画风格的黄昏场景 |

### 处理过程

1. **提取建筑结构**：线条图显示建筑的几何轮廓、窗户排列、立面结构
2. **提取油画风格**：

   * 材质：textured, rough brushwork

   * 色彩：warm, golden-hour tones, high saturation

   * 光照：soft directional light from top-right

   * 氛围：impressionistic, gentle mood, medium depth

### 输出结果

* ✅ **保留**：建筑的精确结构、比例、空间关系

* ✅ **应用**：油画笔触质感、温暖金色调、柔和光影、印象派氛围

* ✅ **融合**：建筑表面呈现油画般的材质渲染，但结构保持建筑学准确性

***

## 六、配置参数说明

```typescript
const DEFAULT_CONFIG: StyleTransferConfig = {
  subjectWeight: 0.6,    // 主体保留权重（0-1，越高越保持原结构）
  styleWeight: 0.4,     // 风格应用权重（0-1，越高越接近参考风格）
  preserveStructure: true, // 是否强制保护结构完整性
  blendMode: 'seamless',   // seamless | layered | artistic
  detailRetention: 0.8,    // 细节保留率（0-1）
};
```

**领域特定优化**：

| 领域               | 保护重点           | 应用范围                |
| ---------------- | -------------- | ------------------- |
| **architecture** | 结构线、承重元素、空间关系  | 表面处理、材质渲染、环境氛围      |
| **product**      | 产品形态、功能界面、品牌元素 | 材质 finish、展示场景、生活方式 |
| **art**          | 构图保真、位置比例      | 创意诠释、艺术增强           |

***

## 七、错误处理机制

```
风格迁移处理失败？
    ↓ YES
回退到常规模式（原始prompt + 原始refs）
    ↓
正常调用 GeminiService.generateImage()
    ↓ NO
使用增强后的 prompt 和 refs
    ↓
继续正常流程
```

**保证**：即使风格迁移失败，也不会影响原有的图像生成功能，完全向后兼容。

***

## 八、控制台日志输出

启用时会输出以下调试信息：

```
[StyleTransfer] 检测到基础图像和风格参考图像，启动风格迁移模式...
[StyleTransfer] 开始提取基础图像主体信息...
[StyleTransfer] 主体提取完成: 15234条边, 47个轮廓
[StyleTransfer] 开始提取参考图像风格信息...
[StyleTransfer] 风格提取完成: 材质=metallic, 色温=warm, 光照=soft
[StyleTransfer] 风格迁移准备完成，生成提示词长度: 1847
[StyleTransfer] 风格迁移提示词已生成: {完整的JSON序列化数据}
```

