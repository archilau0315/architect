# 设置面板布局重构计划

## 当前布局

```
第一行（4列）：
| 画布比例 | 解算精度 | 解算引擎 | 生成数量 + 保真度 |
```

## 目标布局

```
第一行（4列）：
| 画布比例 | 解算精度 | 解算引擎 | 生成数量 |

第二行（2列）：
| 温度 Temperature | 多样性 Top_p |
```

---

## 修改内容

### 1. 移除保真度（Fidelity）

- 从 `config` 中移除 `strictStructure`
- 移除保真度滑杆 UI

### 2. 添加温度（Temperature）滑杆

**Gemini 官方参数范围**：
- 范围：0.0 - 2.0
- 默认值：1.0
- 步进：0.1

**UI 设计**：
```
温度 / Temperature          1.0
[========|========]
0.0                    2.0
```

### 3. 添加多样性（Top_p）滑杆

**Gemini 官方参数范围**：
- 范围：0.0 - 1.0
- 默认值：0.95
- 步进：0.05

**UI 设计**：
```
多样性 / Top_p             0.95
[==================|==]
0.0                    1.0
```

---

## 代码修改

### 1. 更新 config 类型定义

```typescript
// 修改前
interface ImageGenerationConfig {
  aspectRatio: string;
  imageSize: string;
  strictStructure: number;  // 移除
  modelTier: string;
  imageCount: number;
}

// 修改后
interface ImageGenerationConfig {
  aspectRatio: string;
  imageSize: string;
  modelTier: string;
  imageCount: number;
  temperature: number;  // 新增
  top_p: number;        // 新增
}
```

### 2. 更新初始值

```typescript
const [config, setConfig] = useState<ImageGenerationConfig>({ 
  aspectRatio: "1:1", 
  imageSize: "1K", 
  modelTier: "FAST", 
  imageCount: 1,
  temperature: 1.0,   // 新增
  top_p: 0.95         // 新增
});
```

### 3. 修改 UI 布局

**第一行**：画布比例 | 解算精度 | 解算引擎 | 生成数量

**第二行**：温度滑杆 | 多样性滑杆

---

## 修改位置

**文件**：`components/ImageGenerator.tsx`

1. **第56行**：更新 config 初始值
2. **第684-703行**：修改生成数量和保真度区块
3. **新增**：温度和多样性滑杆区块

---

## 注意事项

1. 需要同步更新 `geminiService.ts` 中的请求参数
2. 温度和 top_p 参数需要传递到 API 请求中
3. 确保参数范围与 Gemini API 官方一致
