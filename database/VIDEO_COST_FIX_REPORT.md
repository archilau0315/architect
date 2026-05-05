# 视频积分消耗问题诊断与修复报告

## 📋 问题概述

**日期**: 2026-05-05  
**影响范围**: 视频生成功能的积分消耗记录  
**严重程度**: 中等（部分视频生成未正确扣费）

---

## 🔍 问题分析

### 1. 发现的问题

#### 问题A：后台显示消耗为"-"
- **现象**: 最近两次视频生成记录（2026/5/5 11:24:00 和 11:05:33）的消耗显示为 "-"
- **原因**: `points_cost = 0` 且 `actual_cost = 0`
- **位置**: `backend/admin/dashboard.html:568-570`

#### 问题B：deductBalance函数参数不匹配
- **现象**: 函数调用时传递4个参数，但定义只接受2个
- **影响**: 日志信息不完整，但不影响核心功能
- **位置**: 
  - 调用：`backend/routes/ph8.js:432, 573, 883, 939, 1038`
  - 定义：`backend/services/ph8TokenService.js:38`

#### 问题C：totalTokens数据丢失
- **现象**: 当没有usage对象但响应中有total_tokens字段时，recordUsage调用时totalTokens被硬编码为0
- **位置**: `backend/routes/ph8.js:925`（已修复）

#### 问题D：费用提取逻辑不够健壮
- **现象**: 只检查有限的费用字段，可能遗漏PH8返回的其他格式
- **位置**: `backend/routes/ph8.js:899-902`（已修复）

---

## 💰 积分计算规则验证

### 当前计算公式

```
积分 (points_cost) = Math.round(cost * 1000)
实际成本 (actual_cost) = cost (元)
```

### PH8视频费用标准

| 指标 | 值 |
|------|-----|
| 基础费率 | 100,000 tokens = ¥0.42 |
| 单价 | ¥0.0000042 / token |
| 标准积分/次 | 60 积分（约 ¥0.06） |

### 计算示例

**示例1**: PH8返回 cost=0.06元
```
points_cost = round(0.06 * 1000) = 60 积分 ✅
actual_cost = 0.06 元 ✅
```

**示例2**: PH8返回 total_tokens=142857
```
cost = 142857 * 0.0000042 = 0.60 元
points_cost = round(0.60 * 1000) = 600 积分 ✅
```

---

## 📊 数据库诊断结果

### 需要执行的SQL脚本

#### 1️⃣ 诊断脚本
**文件**: `database/diagnose_video_costs.sql`
**用途**: 查看所有视频记录，识别错误数据

```sql
-- 在phpMyAdmin中执行此脚本查看详细统计
-- 包括：
-- - 视频记录总数和消耗为0的记录数
-- - 按用户统计视频使用情况
-- - 近7天趋势分析
-- - 错误信息模式分析
```

#### 2️⃣ PH8响应分析脚本
**文件**: `database/analyze_ph8_video_responses.sql`
**用途**: 分析PH8 API实际返回的数据格式

```sql
-- 提取ph8_api_logs中的视频相关记录
-- 分析response_body中的费用字段格式
-- 识别包含usage数据的成功响应
```

#### 3️⃣ 数据修正脚本
**文件**: `database/fix_video_costs.sql`
**用途**: 修正错误的积分记录

⚠️ **重要提示**:
- 执行前必须备份数据库！
- 建议先在测试环境验证
- 修正操作不可逆！

---

## 🔧 代码修复清单

### 已完成的修复

✅ **修复1**: `deductBalance`函数签名
- **文件**: `backend/services/ph8TokenService.js`
- **修改**: 增加可选参数 `nickname`, `email`
- **行号**: 第38行

✅ **修复2**: totalTokens数据传递
- **文件**: `backend/routes/ph8.js`
- **修改**: 将硬编码的0改为变量 `totalTokens`
- **行号**: 第925行

✅ **修复3**: 费用提取逻辑增强
- **文件**: `backend/routes/ph8.js`
- **修改**: 支持多种费用字段格式
- **行号**: 第899-902行
- **新增支持**:
  - `responseBody.charge`
  - `responseBody.usage.cost`
  - `responseBody.usage.price`

### 待执行的修复

📋 **修复4**: 数据库历史数据修正
- **步骤**:
  1. 执行 `diagnose_video_costs.sql` 确认问题范围
  2. 执行 `fix_video_costs.sql` 修正数据
  3. 验证修正结果

---

## 📁 文件部署清单

### 需要上传到服务器的文件

| 本地路径 | 服务器路径 | 说明 |
|---------|-----------|------|
| `backend/services/ph8TokenService.js` | `/www/wwwroot/api.kbitai.com.cn/services/ph8TokenService.js` | 修复函数签名 |
| `backend/routes/ph8.js` | `/www/wwwroot/api.kbitai.com.cn/routes/ph8.js` | 修复费用提取逻辑 |

### SQL脚本执行顺序

1. `database/diagnose_video_costs.sql` - 诊断（必选）
2. `database/analyze_ph8_video_responses.sql` - 深度分析（可选）
3. `database/fix_video_costs.sql` - 数据修正（确认后执行）

---

## ✅ 验证步骤

### 1. 重启后端服务
```bash
pm2 restart kbitai-api
```

### 2. 测试视频生成
- 使用测试账号生成一个短视频
- 检查后台日志是否正确显示消耗

### 3. 验证数据库
```sql
SELECT * FROM kbit_usage_logs 
WHERE feature = 'video_gen' 
ORDER BY created_at DESC LIMIT 10;
```

### 4. 检查用户余额
```sql
SELECT id, email, nickname, total_points, daily_used 
FROM kbit_users WHERE id = [测试用户ID];
```

---

## 📈 预期效果

修复完成后：

1. **后台显示正常**: 所有视频生成记录都显示正确的积分消耗
2. **扣费准确**: 按PH8标准费率正确扣减用户积分
3. **日志完整**: 包含用户昵称、邮箱等详细信息
4. **兼容性强**: 支持PH8 API多种响应格式

---

## ⚠️ 注意事项

1. **备份优先**: 修正数据库前务必备份
2. **逐步执行**: 先诊断，再分析，最后修正
3. **监控观察**: 修正后持续监控新产生的记录
4. **回滚准备**: 准备好回滚SQL以防意外

---

## 📞 技术支持

如有问题，请检查：
- 后端日志: `pm2 logs kbitai-api --lines 50`
- 数据库状态: phpMyAdmin中的kbit_usage_logs表
- API响应: ph8_api_logs表中的response_body字段

---

**报告生成时间**: 2026-05-05  
**版本**: v1.0.0  
**作者**: AI Assistant
