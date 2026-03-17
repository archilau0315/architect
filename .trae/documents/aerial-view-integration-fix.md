# 鸟瞰图与底图不一致问题分析与解决方案

## 一、问题诊断

### 根本原因

**鸟瞰图分析服务被导入但从未被调用！**

```
geminiService.ts 第11行：
import { aerialViewAnalysisService, AerialViewAnalysis } from "./aerialViewAnalysisService";

但是搜索整个文件，没有任何地方调用 aerialViewAnalysisService.analyze() 或相关方法！
```

### 问题链条

```
1. 用户上传鸟瞰图草图
2. geminiService.ts 检测到是建筑渲染工作流
3. 但是没有检测是否为鸟瞰图
4. 没有调用 aerialViewAnalysisService.analyze()
5. 没有生成鸟瞰图专用约束
6. AI 只收到普通提示词，没有底图约束
7. AI 自由发挥，导致与底图不一致
```

---

## 二、解决方案

### 2.1 添加鸟瞰图检测逻辑

```typescript
// 在建筑渲染工作流中添加鸟瞰图检测
async detectAerialView(imageDataUrl: string): Promise<boolean> {
  // 方法1：使用 sketchAnalysisService 分析透视类型
  const analysis = await sketchAnalysisService.analyze(imageDataUrl);
  
  const perspective = analysis?.layout?.perspective?.toLowerCase() || '';
  
  return perspective.includes('bird') ||
         perspective.includes('aerial') ||
         perspective.includes('鸟瞰') ||
         perspective.includes('top-down');
}
```

### 2.2 在建筑渲染工作流中调用鸟瞰图分析

```typescript
if (isArchitecturalRendering) {
  // 1. 检测是否为鸟瞰图
  const isAerialView = await this.detectAerialView(baseRefs[0]);
  
  if (isAerialView) {
    // 2. 调用鸟瞰图分析服务
    const aerialAnalysis = await aerialViewAnalysisService.analyze(baseRefs[0]);
    
    // 3. 生成鸟瞰图专用约束
    const aerialConstraints = aerialViewAnalysisService.generateRegionConstraints(aerialAnalysis, prompt);
    
    // 4. 使用鸟瞰图约束替换普通约束
    enhancedPrompt = aerialConstraints;
  } else {
    // 普通建筑渲染流程
    // ...
  }
}
```

### 2.3 确保底图作为参考图传递

```typescript
// 确保底图被正确传递给 Gemini
parts.push({ text: "参考底图（必须严格遵循轮廓和位置）：" });
parts.push({ inlineData: { mimeType: "image/jpeg", data: baseRefData } });
```

---

## 三、代码修改

### 修改文件

```
services/
└── geminiService.ts   # 添加鸟瞰图检测和调用逻辑
```

### 修改内容

1. **添加鸟瞰图检测方法**
   - 使用 sketchAnalysisService 分析透视类型
   - 或使用 aerialViewAnalysisService.isAerialView 字段

2. **在建筑渲染工作流中添加条件分支**
   - 检测是否为鸟瞰图
   - 如果是鸟瞰图，调用 aerialViewAnalysisService
   - 生成专用约束

3. **确保底图正确传递**
   - 底图必须作为参考图传递给 Gemini
   - 添加明确的"必须遵循底图"提示

---

## 四、实施步骤

### 第一阶段：添加鸟瞰图检测

1. 在 geminiService.ts 中添加 detectAerialView 方法
2. 在建筑渲染工作流开始时调用检测

### 第二阶段：集成鸟瞰图分析

3. 如果是鸟瞰图，调用 aerialViewAnalysisService.analyze()
4. 生成鸟瞰图专用约束
5. 替换普通约束

### 第三阶段：验证

6. 测试鸟瞰图渲染
7. 验证底图一致性

---

## 五、关键代码位置

### 需要修改的位置

```
geminiService.ts 第870行左右：
if (isArchitecturalRendering) {
  // 在这里添加鸟瞰图检测和调用
}
```

### 当前代码流程

```
isArchitecturalRendering = true
  ↓
线稿增强
  ↓
材质边界提取
  ↓
Agent分析线稿
  ↓
颜色边界分析
  ↓
构图约束
  ↓
整合提示词
  ↓
发送给Gemini

❌ 缺少：鸟瞰图检测和专用分析
```

### 修正后的代码流程

```
isArchitecturalRendering = true
  ↓
检测是否为鸟瞰图 ← 新增
  ↓
如果是鸟瞰图：
  ├→ 调用 aerialViewAnalysisService.analyze() ← 新增
  ├→ 生成鸟瞰图专用约束 ← 新增
  └→ 使用鸟瞰图约束
如果不是鸟瞰图：
  └→ 使用普通建筑渲染流程
  ↓
发送给Gemini
```

---

## 六、总结

### 问题根源

**鸟瞰图分析服务被导入但从未被调用！**

### 解决方案

1. 添加鸟瞰图检测逻辑
2. 在建筑渲染工作流中调用 aerialViewAnalysisService
3. 生成鸟瞰图专用约束
4. 确保底图正确传递给 Gemini
