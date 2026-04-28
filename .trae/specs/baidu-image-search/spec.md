# 百度相似图片搜索功能 Spec

## Why
当前系统使用"文本关键词"搜索图片，与用户上传的底图毫无相似度。用户需要的是"以图搜图"功能，找与底图风格相似的设计案例。

## What Changes

### 保留现有功能
1. **Chat模式以文搜图** - 保留现有百度网页搜索功能
2. **Tavily海外搜索** - 保留Pro用户海外关键词搜索
3. **自动触发逻辑** - 保留关键词自动触发搜索

### 新增功能
1. **百度相似图片搜索API集成**
   - 调用 `https://aip.baidubce.com/rest/2.0/image-classify/v1/realtime_search/similar` 接口
   - 将用户上传的底图转为base64格式
   - 传入图片检索相似案例

2. **以图搜图流程**
   - 用户上传底图时，自动触发相似图片搜索
   - 搜索结果直接返回相似案例图片URL
   - 无需文字关键词，纯图片匹配

### 技术要求
- 图片base64编码（去掉头部）
- access_token鉴权
- 支持jpg/png/bmp，最大4M
- 返回相似图片的URL和简介

## Impact
- 新增文件: `backend/services/baiduImageSearchService.js`
- 修改文件: `backend/routes/search.js` - 新增 `/api/search/similar` 路由
- 修改文件: `backend/services/searchDispatcher.js` - 新增相似图片搜索分发逻辑

## ADDED Requirements

### Requirement: 以图搜图功能（新增）
当用户上传底图时，系统 SHALL 自动搜索相似的设计案例图片。

#### Scenario: 用户上传底图搜索相似案例
- **WHEN** 用户在聊天模式上传底图并发送
- **THEN** 系统调用百度相似图片搜索API
- **AND** 返回与底图相似的设计案例图片（最多8张）
- **AND** 在用户气泡中显示相似案例图片

### Requirement: 保留以文搜图功能（保留）
当用户发送纯文字消息时，系统 SHALL 使用百度网页搜索返回相关结果。

#### Scenario: 用户发送文字搜索
- **WHEN** 用户在聊天模式发送纯文字（无底图）
- **THEN** 系统调用百度网页搜索
- **AND** 返回相关网页和图片结果

### Requirement: 图片格式转换
系统 SHALL 将用户上传的底图转换为百度API要求的base64格式。

#### Scenario: 底图base64转换
- **WHEN** 用户上传底图
- **THEN** 将图片data URL转为base64（去掉 `data:image/xxx;base64,` 头部）
- **AND** 确保图片大小不超过4M

### Requirement: 相似度排序
系统 SHALL 根据百度返回的相似度分数对结果进行排序。

#### Scenario: 相似图片排序
- **WHEN** 百度返回相似图片结果
- **THEN** 按相似度分数降序排列
- **AND** 过滤掉无效或无法访问的图片URL
