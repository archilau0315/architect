# Checklist

## 百度相似图片搜索功能检查清单

### 服务层
- [x] baiduImageSearchService.js 文件已创建
- [x] access_token 获取逻辑实现（带缓存）
- [x] searchSimilarImage 方法实现
- [x] API错误处理实现
- [x] 图片URL解析和格式化

### 路由层
- [x] POST /api/search/similar 路由已创建
- [x] 路由正确接收 base64 图片数据
- [x] 路由正确调用搜索服务
- [x] 路由正确返回结果

### 前端层
- [x] ConversationView.tsx 修改聊天处理逻辑
- [x] 调用 /api/search/similar 接口
- [x] 用户气泡正确显示相似案例图片
- [x] 无底图时正常文字搜索流程

### 环境配置
- [x] BAIDU_API_KEY 已配置
- [x] BAIDU_SECRET_KEY 已配置
- [x] .env 文件包含百度配置
