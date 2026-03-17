# 不同级别用户下载逻辑梳理

## 一、用户级别定义

根据代码分析，系统支持以下用户级别：

| 级别 | 标识 | 说明 |
|------|------|------|
| 免费用户 | `free` | 基础功能 |
| 基础版 | `basic` | 付费基础版 |
| 专业版 | `pro` | 付费专业版 |
| 高级版 | `plus` | 付费高级版 |

---

## 二、下载功能类型

### 1. 标准下载（带水印）

- **按钮位置**：第821行
- **功能**：下载带水印的图片
- **权限**：所有用户可用

### 2. 高清原片下载（无水印）

- **按钮位置**：第824行
- **功能**：下载无水印高清原片
- **权限**：仅付费用户可用

---

## 三、下载逻辑详细分析

### 代码位置：`ImageGenerator.tsx` 第543-572行

```typescript
const handleDownload = (e: React.MouseEvent, isPro: boolean = false) => {
  e.stopPropagation();
  if (generatedImages.length === 0 || selectedImageIndices.length === 0) return;

  if (isPro) {
    // 高清原片下载逻辑
    if (userTier === 'pro' || userTier === 'plus') {
      // PRO/PLUS 用户：无限下载
      if (!window.confirm(`确认下载 ${selectedImageIndices.length} 张无水印高清原片？\n(请遵守版权合规使用协议)`)) return;
      WatermarkUtils.logDownload({ imageId: Date.now().toString(), type: 'pro' });
    } else if (userTier === 'basic') {
      // BASIC 用户：每日10次配额
      const QUOTA_KEY = 'KBIT_BASIC_PRO_QUOTA';
      const today = new Date().toDateString();
      const quotaData = JSON.parse(localStorage.getItem(QUOTA_KEY) || `{"date":"${today}","count":0}`);
      let currentCount = quotaData.date === today ? quotaData.count : 0;

      if (currentCount >= 10) {
        window.alert("今日 10 次基础版无水印配额已用完。升级 PRO/PLUS 可享无限下载。");
        return;
      }

      if (!window.confirm(`基础版每日无水印下载配额剩余：${9 - currentCount} 次。\n确认下载高清原片？`)) return;
      
      localStorage.setItem(QUOTA_KEY, JSON.stringify({ date: today, count: currentCount + 1 }));
      WatermarkUtils.logDownload({ imageId: Date.now().toString(), type: 'free_pro_quota' });
    } else {
      // FREE 用户：无权限
      window.alert("权限不足：无水印下载仅限付费用户（基础/PRO/PLUS）。免费用户请使用标准下载。");
      return;
    }
  } else {
    // 标准下载（带水印）
    WatermarkUtils.logDownload({ imageId: Date.now().toString(), type: 'standard' });
  }
  
  // 执行下载...
};
```

---

## 四、权限矩阵

| 用户级别 | 标准下载（带水印） | 高清原片（无水印） | 配额限制 |
|---------|------------------|------------------|---------|
| **free** | ✅ 可用 | ❌ 无权限 | - |
| **basic** | ✅ 可用 | ✅ 可用 | 每日10次 |
| **pro** | ✅ 可用 | ✅ 可用 | 无限 |
| **plus** | ✅ 可用 | ✅ 可用 | 无限 |

---

## 五、配额存储机制

### BASIC 用户配额

- **存储位置**：`localStorage`
- **Key**：`KBIT_BASIC_PRO_QUOTA`
- **数据格式**：
```json
{
  "date": "Thu Mar 13 2025",
  "count": 5
}
```
- **重置逻辑**：每天自动重置（检测日期变化）

---

## 六、下载日志记录

使用 `WatermarkUtils.logDownload()` 记录下载行为：

| 下载类型 | 标识 |
|---------|------|
| 标准下载 | `standard` |
| PRO/PLUS 高清下载 | `pro` |
| BASIC 配额下载 | `free_pro_quota` |

---

## 七、其他权限控制

### 1. 图像尺寸限制（第644行）

```typescript
const isLocked = userTier === 'free' && s !== '1K';
```

- **FREE 用户**：只能使用 1K 尺寸
- **付费用户**：可使用 1K/2K/4K

### 2. 解算引擎限制（第662行）

```typescript
const isLocked = userTier === 'free' && t !== 'FAST';
```

- **FREE 用户**：只能使用 FAST 引擎
- **付费用户**：可使用 FAST/QUALITY

---

## 八、总结

### ✅ 已实现的功能

1. **多级别用户权限控制**
2. **标准下载（带水印）- 所有用户可用**
3. **高清原片下载（无水印）- 付费用户可用**
4. **BASIC 用户每日配额限制（10次）**
5. **配额自动重置（每日）**
6. **下载日志记录**
7. **图像尺寸权限控制**
8. **解算引擎权限控制**

### 代码实现完整，无需修改。
