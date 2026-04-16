# 水印路径修复计划

## 问题分析

根据服务器和本地的目录结构：

**服务器结构**：
- `/www/wwwroot/kbitai.com.cn/public/` - 公共资源文件夹（包含 LOGOkbitwater.png、archi01.png 等）
- `/www/wwwroot/kbitai.com.cn/architect/` - architect 应用

**本地结构**：
- `kbitai_com_cn/public/` - 公共资源文件夹
- `kbitai_com_cn/Architect(NewUI)/` - architect 应用

**问题根源**：
- 代码中使用了错误的资源路径（如 `/architect/LOGOkbitwater.png`）
- 正确路径应该是 `/public/LOGOkbitwater.png`（直接指向主网站的 public 文件夹）

## 修复方案

### 1. 统一水印路径
将所有水印相关路径从 `/architect/xxx.png` 修改为 `/public/xxx.png`

### 2. 更新文件列表

| 文件 | 修改内容 |
|------|----------|
| `services/watermarkService.ts` | 水印路径改为 `/public/LOGOkbitwater.png` |
| `services/videoWatermarkService.ts` | 水印路径改为 `/public/LOGOkbitwater.png` |
| `services/geminiService.ts` | 水印路径改为 `/public/LOGOkbitwater.png` |
| `services/imageService.ts` | 水印路径改为 `/public/LOGOkbitwater.png` |
| `components/ConversationView.tsx` | 水印路径改为 `/public/LOGOkbitwater.png` |
| `components/VideoGenerator.tsx` | 水印路径改为 `/public/LOGOkbitwater.png` |
| `vite.config.ts` | 添加 `/public/` 路径代理规则 |

### 3. Vite 代理配置
添加代理规则使开发环境能正确访问公共资源：
```typescript
proxy: {
  '/public/': {
    target: 'http://127.0.0.1:3001',
    changeOrigin: true,
    rewrite: (path) => '/architect' + path,
    secure: false,
  }
}
```

### 4. 服务器部署配置
确保 nginx 配置中 `/public/` 路径指向正确的目录：
```nginx
location /public/ {
    root /www/wwwroot/kbitai.com.cn/;
}
```

## 验证步骤

1. 启动开发服务器
2. 生成一张图片，观察水印是否正确显示
3. 打开浏览器控制台，确认没有 404 错误
4. 测试全屏模式是否正常工作

## 风险评估

- **低风险**：路径修改是向后兼容的，服务器端只需确保 nginx 配置正确
- **注意**：部署时需要确保 public 文件夹存在于服务器根目录