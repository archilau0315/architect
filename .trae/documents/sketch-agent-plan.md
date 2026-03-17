# 线稿识别增强Agent技术方案

## 一、需求分析

### 目标
增强底图线稿的识别能力，让生图可以准确遵循线稿，并将解析的底图内容通过结构化语言传递给Gemini模型。

### 核心问题
当前建筑渲染工作流中，Gemini可能无法准确理解线稿的结构和细节，导致生成的图像与线稿不一致。

---

## 二、技术路线

### 方案概述
```
线稿图片 → Gemini Vision分析 → 结构化JSON描述 → 增强提示词 → Gemini生图
```

### 技术栈
1. **Gemini Vision API** - 图像理解和分析
2. **Structured Output** - 强制输出JSON格式
3. **Prompt Engineering** - 提示词增强
4. **多模型协作** - 分析模型 + 生成模型

---

## 三、实现方案

### 阶段1：线稿分析Agent

#### 1.1 图像理解模块
使用 Gemini Vision API 分析线稿图片，提取以下信息：

```typescript
interface SketchAnalysis {
  // 整体描述
  overallDescription: string;
  
  // 建筑元素
  buildingElements: {
    type: string;        // 建筑类型：住宅、商业、公共建筑等
    floors: number;      // 楼层数
    style: string;       // 建筑风格
    shape: string;       // 整体形状描述
  };
  
  // 结构元素
  structuralElements: Array<{
    name: string;        // 元素名称：窗户、门、阳台、屋顶等
    position: string;    // 位置描述
    shape: string;       // 形状描述
    size: string;        // 相对大小
    count: number;       // 数量
  }>;
  
  // 布局信息
  layout: {
    orientation: string; // 朝向
    perspective: string; // 透视角度
    composition: string; // 构图方式
  };
  
  // 线条特征
  lineCharacteristics: {
    style: string;       // 线条风格：手绘、CAD、草图等
    thickness: string;   // 线条粗细
    detail: string;      // 细节程度
  };
  
  // 环境元素
  environmentElements: Array<{
    type: string;        // 类型：树木、道路、人物等
    position: string;    // 位置
  }>;
}
```

#### 1.2 结构化输出配置
使用 Gemini 的 `responseSchema` 强制输出结构化JSON：

```typescript
const analysisConfig = {
  responseMimeType: "application/json",
  responseSchema: {
    type: "object",
    properties: {
      buildingElements: { type: "object" },
      structuralElements: { type: "array" },
      layout: { type: "object" },
      // ...
    }
  }
};
```

### 阶段2：提示词增强模块

#### 2.1 结构化描述转换
将JSON描述转换为详细的自然语言提示词：

```typescript
function buildEnhancedPrompt(analysis: SketchAnalysis, userPrompt: string): string {
  return `
【线稿结构分析】

建筑主体：
- 类型：${analysis.buildingElements.type}
- 楼层：${analysis.buildingElements.floors}层
- 风格：${analysis.buildingElements.style}
- 形态：${analysis.buildingElements.shape}

结构元素：
${analysis.structuralElements.map(e => 
  `- ${e.name}：${e.count}个，位于${e.position}，${e.shape}形状`
).join('\n')}

布局特征：
- 朝向：${analysis.layout.orientation}
- 透视：${analysis.layout.perspective}
- 构图：${analysis.layout.composition}

【生成要求】
请严格按照上述线稿结构生成建筑渲染图：
${userPrompt}
`;
}
```

### 阶段3：多模型协作流程

#### 3.1 完整工作流
```typescript
async function sketchToRenderWorkflow(
  sketchImage: string,      // 线稿图片
  segmentationImage: string, // 语义分割图（可选）
  userPrompt: string        // 用户提示词
): Promise<string> {
  
  // Step 1: 分析线稿
  const analysis = await analyzeSketch(sketchImage);
  
  // Step 2: 构建增强提示词
  const enhancedPrompt = buildEnhancedPrompt(analysis, userPrompt);
  
  // Step 3: 生成图像
  const result = await generateImage({
    prompt: enhancedPrompt,
    baseImage: sketchImage,
    segmentationImage: segmentationImage,
    model: "gemini-3-pro-image-preview"
  });
  
  return result;
}
```

---

## 四、技术实现细节

### 4.1 Gemini Vision 分析提示词

```
你是一位专业的建筑线稿分析师。请仔细分析这张建筑线稿图片，提取以下信息：

1. 建筑主体特征
   - 建筑类型（住宅/商业/公共建筑/工业建筑等）
   - 楼层数量
   - 建筑风格（现代/古典/简约/装饰艺术等）
   - 整体形态描述

2. 结构元素识别
   - 窗户：数量、位置、形状、大小
   - 门：位置、类型、尺寸
   - 阳台：位置、数量、形式
   - 屋顶：类型、特征
   - 其他装饰元素

3. 布局与透视
   - 视角（正视/侧视/鸟瞰/仰视）
   - 透视类型（一点透视/两点透视/三点透视）
   - 构图方式

4. 线条特征
   - 线条风格
   - 细节程度
   - 标注信息

请以JSON格式输出分析结果。
```

### 4.2 模型选择

| 任务 | 推荐模型 | 原因 |
|------|---------|------|
| 线稿分析 | gemini-2.5-pro | 更强的视觉理解能力 |
| 结构化输出 | gemini-2.5-flash | 快速、支持JSON schema |
| 图像生成 | gemini-3-pro-image-preview | 专业图像生成 |

### 4.3 错误处理与回退

```typescript
async function analyzeWithFallback(image: string): Promise<SketchAnalysis> {
  try {
    // 尝试使用 Pro 模型分析
    return await analyzeWithPro(image);
  } catch (error) {
    console.warn("Pro分析失败，使用Flash回退");
    return await analyzeWithFlash(image);
  }
}
```

---

## 五、代码结构

### 5.1 新增文件

```
services/
├── sketchAnalysisService.ts    # 线稿分析服务
├── promptEnhancerService.ts    # 提示词增强服务
└── agentWorkflowService.ts     # Agent工作流编排

components/
└── SketchAnalysisPanel.tsx     # 分析结果展示面板
```

### 5.2 接口设计

```typescript
// 线稿分析服务
export class SketchAnalysisService {
  async analyze(imageDataUrl: string): Promise<SketchAnalysis>;
  async analyzeWithSchema(imageDataUrl: string, schema: object): Promise<any>;
}

// 提示词增强服务
export class PromptEnhancerService {
  enhance(analysis: SketchAnalysis, userPrompt: string): string;
  formatForGeneration(analysis: SketchAnalysis): string;
}

// Agent工作流服务
export class AgentWorkflowService {
  async executeSketchToRender(input: {
    sketchImage: string;
    segmentationImage?: string;
    userPrompt: string;
  }): Promise<string>;
}
```

---

## 六、预期效果

### 6.1 线稿遵循度提升
- 准确识别建筑结构元素
- 保持正确的透视和比例
- 遵循线稿的构图布局

### 6.2 用户体验改善
- 自动分析线稿内容
- 智能生成增强提示词
- 减少手动描述工作量

---

## 七、实施步骤

### 第一阶段：基础功能
1. 创建 `SketchAnalysisService` 线稿分析服务
2. 实现 Gemini Vision 结构化输出
3. 创建 `PromptEnhancerService` 提示词增强服务
4. 集成到现有建筑渲染工作流

### 第二阶段：优化迭代
1. 优化分析提示词模板
2. 添加分析结果可视化
3. 支持用户编辑分析结果
4. 添加分析结果缓存

### 第三阶段：高级功能
1. 支持多轮对话优化
2. 添加历史记录学习
3. 支持自定义分析维度
4. 集成到后端代理服务

---

## 八、解析文件处理方案

### 8.1 数据流程图

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  线稿图片    │ ──→ │ Gemini Vision    │ ──→ │ 结构化JSON数据   │
│  (base64)   │     │ 分析服务          │     │ SketchAnalysis  │
└─────────────┘     └──────────────────┘     └─────────────────┘
                                                    │
                    ┌───────────────────────────────┤
                    │                               │
                    ▼                               ▼
          ┌─────────────────┐            ┌─────────────────┐
          │ 内存缓存         │            │ IndexedDB存储    │
          │ (当前会话)       │            │ (历史记录)       │
          └─────────────────┘            └─────────────────┘
                    │
                    ▼
          ┌─────────────────┐
          │ 提示词增强服务    │
          └─────────────────┘
                    │
                    ▼
          ┌─────────────────┐
          │ 增强后的提示词    │
          └─────────────────┘
                    │
                    ▼
          ┌─────────────────┐
          │ Gemini 生图模型  │
          └─────────────────┘
```

### 8.2 解析结果存储策略

#### 内存缓存（当前会话）
```typescript
// 会话级缓存 - 用于当前操作
class AnalysisCache {
  private cache: Map<string, SketchAnalysis> = new Map();
  
  set(imageId: string, analysis: SketchAnalysis): void {
    this.cache.set(imageId, analysis);
  }
  
  get(imageId: string): SketchAnalysis | undefined {
    return this.cache.get(imageId);
  }
  
  clear(): void {
    this.cache.clear();
  }
}
```

#### IndexedDB存储（历史记录）
```typescript
// 持久化存储 - 用于历史查询和复用
interface AnalysisRecord {
  id: string;
  imageHash: string;      // 图片哈希，用于去重
  analysis: SketchAnalysis;
  createdAt: Date;
  userId: string;
}

class AnalysisStorage {
  async save(record: AnalysisRecord): Promise<void>;
  async findByHash(imageHash: string): Promise<AnalysisRecord | null>;
  async listByUser(userId: string): Promise<AnalysisRecord[]>;
  async delete(id: string): Promise<void>;
}
```

### 8.3 解析结果使用方式

#### 方式1：直接传递（推荐）
```typescript
// 解析结果直接传递给生图服务，不生成中间文件
async function generateWithAnalysis(
  sketchImage: string,
  userPrompt: string
): Promise<string> {
  // 1. 分析线稿（结果在内存中）
  const analysis = await sketchAnalysisService.analyze(sketchImage);
  
  // 2. 直接使用分析结果构建提示词
  const enhancedPrompt = promptEnhancer.enhance(analysis, userPrompt);
  
  // 3. 传递给生图服务
  return await imageGenerationService.generate({
    prompt: enhancedPrompt,
    baseImage: sketchImage
  });
}
```

#### 方式2：缓存复用
```typescript
// 检查是否有相同图片的分析结果，避免重复调用API
async function analyzeWithCache(imageDataUrl: string): Promise<SketchAnalysis> {
  const imageHash = await hashImage(imageDataUrl);
  
  // 先查缓存
  const cached = await analysisStorage.findByHash(imageHash);
  if (cached) {
    console.log("[分析缓存命中]", imageHash);
    return cached.analysis;
  }
  
  // 缓存未命中，调用API分析
  const analysis = await sketchAnalysisService.analyze(imageDataUrl);
  
  // 保存到缓存
  await analysisStorage.save({
    id: generateId(),
    imageHash,
    analysis,
    createdAt: new Date(),
    userId: getCurrentUserId()
  });
  
  return analysis;
}
```

### 8.4 解析结果可视化

```typescript
// 在UI中展示解析结果，让用户可以编辑
interface AnalysisPanelProps {
  analysis: SketchAnalysis;
  onChange: (analysis: SketchAnalysis) => void;
}

// 用户可以修改识别错误的元素
function SketchAnalysisPanel({ analysis, onChange }: AnalysisPanelProps) {
  return (
    <div className="analysis-panel">
      <h3>建筑元素</h3>
      <EditableField 
        label="建筑类型" 
        value={analysis.buildingElements.type}
        onChange={(v) => updateAnalysis('buildingElements.type', v)}
      />
      
      <h3>结构元素</h3>
      {analysis.structuralElements.map((elem, idx) => (
        <StructuralElementEditor 
          key={idx}
          element={elem}
          onChange={(e) => updateElement(idx, e)}
        />
      ))}
    </div>
  );
}
```

### 8.5 数据生命周期

| 阶段 | 存储位置 | 持久性 | 用途 |
|------|---------|--------|------|
| 分析中 | 内存 | 临时 | API调用过程 |
| 当前会话 | 内存Map | 会话级 | 快速复用 |
| 历史记录 | IndexedDB | 持久化 | 跨会话复用 |
| 生成后 | 不保留 | - | 结果已用于生图 |

### 8.6 隐私与安全

```typescript
// 敏感数据处理策略
class DataPrivacyHandler {
  // 用户可选择不保存分析历史
  private saveHistory: boolean = false;
  
  // 会话结束时清理内存缓存
  clearSessionData(): void {
    analysisCache.clear();
  }
  
  // 用户请求删除所有历史
  async deleteAllUserData(): Promise<void> {
    await analysisStorage.deleteByUser(getCurrentUserId());
  }
}
```

---

## 九、风险评估

### 9.1 技术风险
- Gemini Vision 可能无法准确识别复杂线稿
- 结构化输出可能有格式错误
- 多模型调用增加延迟

### 9.2 解决方案
- 使用多模型对比验证
- 添加输出格式校验和修复
- 实现异步处理和缓存机制

---

## 十、总结

本方案通过 **Gemini Vision 分析 + 结构化输出 + 提示词增强** 的技术路线，实现线稿识别增强Agent能力。核心是利用Gemini的多模态理解能力，将线稿转换为结构化描述，再通过增强的提示词指导图像生成模型，从而提高线稿遵循度。

**关键技术点：**
1. Gemini Vision 图像理解
2. Structured Output 强制JSON输出
3. Prompt Engineering 提示词工程
4. 多模型协作工作流
