# Tasks

## 任务1: 创建百度相似图片搜索服务
- [x] 创建 `backend/services/baiduImageSearchService.js`
- [x] 实现 `searchSimilarImage(imageBase64, options)` 方法
- [x] 实现 access_token 获取和缓存逻辑
- [x] 实现相似图片搜索API调用
- [x] 实现结果解析和格式化
- [x] 移除硬编码密钥，使用环境变量

## 任务2: 添加相似图片搜索路由
- [x] 创建 `POST /api/search/similar` 路由
- [x] 接收前端传来的 base64 图片数据
- [x] 调用 baiduImageSearchService
- [x] 返回相似图片URL列表

## 任务3: 修改搜索分发器
- [x] 在 searchDispatcher.js 中新增相似图片搜索方法
- [x] 判断是否需要执行以图搜图（用户上传了底图）
- [x] 整合普通搜索和相似图片搜索

## 任务4: 前端集成
- [x] 修改 ConversationView.tsx 的聊天处理逻辑
- [x] 当用户上传底图时，调用 `/api/search/similar`
- [x] 在用户气泡中显示相似案例图片
- [x] 移除关键词限制，只要上传图片就触发搜索

## 任务5: 安全凭据管理
- [x] 服务器配置环境变量
- [x] 移除代码中的硬编码密钥
- [x] 权限设置（chmod 600）
- [x] 创建 .env.example 示例文件

## 任务6: 测试验证
- [x] 测试百度API access_token 获取
- [x] 测试相似图片搜索接口
- [x] 测试前端调用和图片显示
- [x] 验证图片相似度

# Task Dependencies
- 任务2 依赖 任务1（需要服务存在）
- 任务3 依赖 任务1
- 任务4 依赖 任务2
- 任务5 依赖 任务1
- 任务6 依赖 所有任务完成
