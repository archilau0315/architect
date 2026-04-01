# API路由404错误修复指南

## 问题描述
管理员登录时报错：
- `Failed to load resource: the server responded with a status of 404 (Not Found)`
- `api/admin/login:1 Failed to load resource`
- `SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON`

## 原因分析
前端请求 `/api/admin/login`，但nginx配置中没有将 `/api/` 路径路由到PHP后端，导致返回404 HTML页面。

## 解决方案

### 方法1：修改nginx配置（推荐）

在宝塔面板中：
1. 进入"网站" → 找到 `kbitai.com.cn` → 点击"设置"
2. 选择"配置文件"标签
3. 在 `location /architect` 之前添加以下配置：

```nginx
# API路由 - 转发到PHP后端
location /api/ {
    root /www/wwwroot/kbitai.com.cn/architect;
    rewrite ^/api/(.*)$ /bankend/index.php last;
}

# PHP处理
location ~ ^/bankend/.*\.php$ {
    root /www/wwwroot/kbitai.com.cn/architect;
    fastcgi_pass unix:/tmp/php-cgi-82.sock;
    fastcgi_index index.php;
    fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    include fastcgi_params;
    fastcgi_connect_timeout 300;
    fastcgi_send_timeout 300;
    fastcgi_read_timeout 300;
}
```

4. 保存后重载nginx配置
