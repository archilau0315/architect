# PH8.co Token 精准监控实现计划

## 项目目标
实现精准监控通过 ph8.co 调用大模型 API 的用户 Token 实际消耗，替代现有的估算方式。

## 核心需求
1. 从 ph8.co 响应提取官方 Token 消耗数据
2. 记录消耗明细并同步用户 Token 余额
3. 包含异常处理机制

---

## 任务分解

### [/] 任务 1: 数据库设计
**优先级**: P0
**依赖**: 无
**描述**:
设计并创建数据库表结构，用于存储 PH8 Token 消耗明细和用户余额。

**数据库表结构**:

```sql
-- PH8 Token 消耗明细表
CREATE TABLE IF NOT EXISTS ph8_token_usage (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usage_id VARCHAR(64) UNIQUE NOT NULL COMMENT '使用记录唯一ID',
  user_id VARCHAR(64) NOT NULL COMMENT '用户ID',
  request_id VARCHAR(128) COMMENT 'PH8请求ID',
  model VARCHAR(64) NOT NULL COMMENT '使用的模型',
  prompt_tokens INT DEFAULT 0 COMMENT '输入token数',
  completion_tokens INT DEFAULT 0 COMMENT '输出token数',
  total_tokens INT NOT NULL COMMENT '总token数',
  cached_tokens INT DEFAULT 0 COMMENT '缓存token数（如有）',
  request_type ENUM('image', 'video', 'chat', 'audio') NOT NULL COMMENT '请求类型',
  endpoint VARCHAR(255) COMMENT '调用的API端点',
  status ENUM('success', 'error', 'timeout') DEFAULT 'success' COMMENT '请求状态',
  error_message TEXT COMMENT '错误信息（如有）',
  response_time_ms INT COMMENT '响应时间（毫秒）',
  ip_address VARCHAR(45) COMMENT '用户IP地址',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_request_id (request_id),
  INDEX idx_created_at (created_at),
  INDEX idx_request_type (request_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='PH8 Token消耗明细表';

-- 用户 PH8 Token 余额表
CREATE TABLE IF NOT EXISTS user_ph8_balance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(64) UNIQUE NOT NULL COMMENT '用户ID',
  total_balance INT DEFAULT 0 COMMENT '总余额（token）',
  used_today INT DEFAULT 0 COMMENT '今日已用',
  used_this_month INT DEFAULT 0 COMMENT '本月已用',
  total_used BIGINT DEFAULT 0 COMMENT '累计使用',
  last_request_at TIMESTAMP NULL COMMENT '最后请求时间',
  last_reset_daily TIMESTAMP NULL COMMENT '每日重置时间',
  last_reset_monthly TIMESTAMP NULL COMMENT '每月重置时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_balance (total_balance)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户PH8 Token余额表';

-- PH8 API 调用日志表（用于调试和审计）
CREATE TABLE IF NOT EXISTS ph8_api_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  log_id VARCHAR(64) UNIQUE NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  request_body TEXT COMMENT '请求体（脱敏）',
  response_body TEXT COMMENT '响应体（脱敏）',
  status_code INT COMMENT 'HTTP状态码',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_endpoint (endpoint),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='PH8 API调用日志';
```

**成功标准**:
- 所有表创建成功
- 索引正确建立
- 表结构符合业务需求

**测试要求**:
- `programmatic` TR-1.1: 表结构能够正确创建
- `programmatic` TR-1.2: 索引能够正确建立

---

### [ ] 任务 2: 修改 PH8 代理路由
**优先级**: P0
**依赖**: 任务 1
**描述**:
修改 `backend/routes/ph8.js`，从 ph8.co 响应中提取官方 Token 消耗数据，并记录到数据库。

**实现细节**:
1. 拦截 ph8.co 的响应
2. 解析响应中的 usage 字段（包含 token 消耗信息）
3. 提取 prompt_tokens, completion_tokens, total_tokens
4. 记录到 ph8_token_usage 表
5. 更新用户余额
6. 添加异常处理

**代码结构**:
```javascript
// 关键逻辑
- 代理请求到 ph8.co
- 接收响应并解析
- 提取 usage 数据
- 异步记录到数据库（不阻塞响应）
- 更新用户余额
- 错误处理和日志记录
```

**成功标准**:
- 能够正确代理请求
- 能够从响应中提取 token 数据
- 能够记录到数据库
- 异常情况下不阻塞用户请求

**测试要求**:
- `programmatic` TR-2.1: 代理请求正常工作
- `programmatic` TR-2.2: 能够正确解析响应中的 usage 数据
- `programmatic` TR-2.3: 数据库记录正确
- `human-judgement` TR-2.4: 响应时间不显著增加

---

### [ ] 任务 3: 创建 Token 记录服务模块
**优先级**: P0
**依赖**: 任务 1
**描述**:
创建独立的 Token 记录服务模块，封装数据库操作逻辑。

**文件**: `backend/services/ph8TokenService.js`

**功能**:
1. `recordUsage(data)` - 记录 token 使用
2. `updateUserBalance(userId, tokens)` - 更新用户余额
3. `getUserBalance(userId)` - 获取用户余额
4. `getUserUsageStats(userId, startDate, endDate)` - 获取用户使用统计
5. `resetDailyUsage()` - 重置每日使用计数
6. `resetMonthlyUsage()` - 重置每月使用计数

**成功标准**:
- 所有函数正常工作
- 数据库操作正确
- 错误处理完善

**测试要求**:
- `programmatic` TR-3.1: 所有函数能够正确执行
- `programmatic` TR-3.2: 数据库操作正确
- `programmatic` TR-3.3: 错误处理正确

---

### [ ] 任务 4: 创建用户余额管理 API
**优先级**: P1
**依赖**: 任务 3
**描述**:
创建 API 路由，用于管理用户 PH8 Token 余额和查询使用记录。

**文件**: `backend/routes/ph8Balance.js`

**API 端点**:
1. `GET /api/ph8/balance` - 获取当前用户余额
2. `GET /api/ph8/usage` - 获取用户使用记录
3. `GET /api/ph8/stats` - 获取使用统计
4. `POST /api/ph8/recharge` - 充值（管理员接口）
5. `GET /api/ph8/usage/:userId` - 获取指定用户使用记录（管理员）

**成功标准**:
- 所有 API 正常工作
- 权限控制正确
- 响应格式统一

**测试要求**:
- `programmatic` TR-4.1: 所有 API 返回正确数据
- `programmatic` TR-4.2: 权限控制正确
- `human-judgement` TR-4.3: API 响应时间合理

---

### [ ] 任务 5: 前端集成
**优先级**: P1
**依赖**: 任务 4
**描述**:
修改前端代码，显示用户的 PH8 Token 余额和使用情况。

**修改文件**:
1. `services/ph8UsageService.ts` - 更新为使用实际 API
2. `components/SettingsPanel.tsx` - 显示 PH8 Token 余额
3. `App.tsx` - 初始化时加载余额

**功能**:
1. 显示当前 PH8 Token 余额
2. 显示今日/本月使用统计
3. 显示最近使用记录
4. 余额不足时提示

**成功标准**:
- 前端能够正确显示余额
- 使用记录正确显示
- 余额不足时有提示

**测试要求**:
- `programmatic` TR-5.1: 前端能够正确获取数据
- `human-judgement` TR-5.2: 界面显示正确
- `human-judgement` TR-5.3: 用户体验良好

---

### [ ] 任务 6: 异常处理和日志
**优先级**: P1
**依赖**: 任务 2, 任务 3
**描述**:
完善异常处理机制和日志记录。

**异常处理场景**:
1. PH8 API 响应超时
2. PH8 API 返回错误
3. 数据库连接失败
4. 用户余额不足
5. 响应解析失败

**日志记录**:
1. 所有 API 调用记录
2. 错误信息详细记录
3. 性能指标记录

**成功标准**:
- 所有异常场景有处理
- 日志记录完整
- 不影响用户体验

**测试要求**:
- `programmatic` TR-6.1: 异常处理正确
- `programmatic` TR-6.2: 日志记录完整
- `human-judgement` TR-6.3: 用户体验不受影响

---

### [ ] 任务 7: 定时任务
**优先级**: P2
**依赖**: 任务 3
**描述**:
创建定时任务，自动重置每日/每月使用计数。

**实现方式**:
1. 使用 node-cron 创建定时任务
2. 每天 00:00 重置每日计数
3. 每月 1 日 00:00 重置每月计数

**成功标准**:
- 定时任务正常运行
- 重置逻辑正确

**测试要求**:
- `programmatic` TR-7.1: 定时任务正常运行
- `programmatic` TR-7.2: 重置逻辑正确

---

### [ ] 任务 8: 测试和验证
**优先级**: P0
**依赖**: 所有任务
**描述**:
完整测试整个系统，确保功能正常。

**测试内容**:
1. 生图功能测试
2. 视频生成功能测试
3. Chat 功能测试
4. Token 记录准确性验证
5. 余额更新验证
6. 异常场景测试
7. 性能测试

**成功标准**:
- 所有功能正常工作
- Token 记录准确
- 性能满足要求

**测试要求**:
- `programmatic` TR-8.1: 所有功能测试通过
- `programmatic` TR-8.2: Token 记录准确
- `human-judgement` TR-8.3: 性能满足要求

---

## 技术栈
- **后端**: Node.js + Express
- **数据库**: MySQL
- **前端**: React + TypeScript
- **定时任务**: node-cron

## 输出物
1. 可运行的后端代码
2. 前端集成代码
3. 数据库设计 SQL
4. 使用说明文档
5. API 文档

## 注意事项
1. 确保不影响现有功能
2. 异步处理数据库操作，不阻塞用户请求
3. 完善的错误处理，确保系统稳定性
4. 考虑性能优化，避免数据库瓶颈