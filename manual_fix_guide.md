# Nginx 配置手动修复指南

## 问题分析

1. **nginx_config.txt 文件不存在**：需要上传到服务器
2. **set_by_lua_block 指令错误**：Nginx 没有安装 Lua 模块，需要移除相关配置

## 修复步骤

### 步骤 1：恢复 Nginx 配置备份

```bash
# 恢复之前的备份
cp /www/server/panel/vhost/nginx/api.kbitai.com.cn.conf.bak /www/server/panel/vhost/nginx/api.kbitai.com.cn.conf
```

### 步骤 2：编辑 Nginx 配置文件

```bash
# 使用 nano 或 vim 编辑配置文件
nano /www/server/panel/vhost/nginx/api.kbitai.com.cn.conf
```

### 步骤 3：修改配置文件内容

找到并删除以下行（大约在第11-14行）：

```nginx
#CERT-APPLY-CHECK--START
# 用于SSL证书申请时的文件验证相关配置 -- 请勿删除
include /www/server/panel/vhost/nginx/well-known/api.kbitai.com.cn.conf;
#CERT-APPLY-CHECK--END
```

同时删除：

```nginx
include /www/server/panel/vhost/nginx/extension/api.kbitai.com.cn/*.conf;
```

### 步骤 4：简化 HTTP 到 HTTPS 的重定向

将原来的复杂重定向逻辑：

```nginx
#HTTP_TO_HTTPS_START
set $isRedcert 1;
if ($server_port != 443) {
    set $isRedcert 2;
}
if ( $uri ~ /\.well-known/ ) {
    set $isRedcert 1;
}
if ($isRedcert != 1) {
    rewrite ^(/.*)$ https://$host$1 permanent;
}
#HTTP_TO_HTTPS_END
```

改为简单的：

```nginx
#HTTP_TO_HTTPS_START
if ($server_port != 443) {
    rewrite ^(/.*)$ https://$host$1 permanent;
}
#HTTP_TO_HTTPS_END
```

### 步骤 5：确保 PHP 配置正确

确保 PHP location 块包含 Authorization header：

```nginx
location ~ \.php$ {
    fastcgi_pass unix:/tmp/php-cgi-82.sock;
    fastcgi_index index.php;
    fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    include fastcgi_params;
    
    # 确保 Authorization Header 被传递给 PHP
    fastcgi_param HTTP_AUTHORIZATION $http_authorization;
}
```

### 步骤 6：测试和重启 Nginx

```bash
# 测试配置
nginx -t

# 如果测试通过，重启 Nginx
systemctl restart nginx

# 检查状态
systemctl status nginx
```

## 完整的简化配置示例

```nginx
server
{
    listen 80;
    listen 443 ssl;
    server_name api.kbitai.com.cn;
    index index.php index.html index.htm default.php default.htm default.html;
    root /www/wwwroot/api.kbitai.com.cn;
    
    #SSL-START SSL相关配置，请勿删除或修改下一行带注释的404规则
    #error_page 404/404.html;
    
    #HTTP_TO_HTTPS_START
    if ($server_port != 443) {
        rewrite ^(/.*)$ https://$host$1 permanent;
    }
    #HTTP_TO_HTTPS_END
    
    ssl_certificate    /www/server/panel/vhost/cert/api.kbitai.com.cn/fullchain.pem;
    ssl_certificate_key    /www/server/panel/vhost/cert/api.kbitai.com.cn/privkey.pem;
    ssl_protocols TLSv1.1 TLSv1.2 TLSv1.3;
    ssl_ciphers EECDH+CHACHA20:EECDH+CHACHA20-draft:EECDH+AES128:RSA+AES128:EECDH+AES256:RSA+AES256:EECDH+3DES:RSA+3DES:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_tickets on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    add_header Strict-Transport-Security "max-age=31536000";

    error_page 497 https://$host$request_uri;

    #SSL-END

    #ERROR-PAGE-START  错误页配置，可以注释、删除或修改
    error_page 404 /404.html;
    #ERROR-PAGE-END

    #PHP-INFO-START  PHP引用配置，可以注释或修改
    location ~ \.php$ {
        fastcgi_pass unix:/tmp/php-cgi-82.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
        
        # 确保 Authorization Header 被传递给 PHP
        fastcgi_param HTTP_AUTHORIZATION $http_authorization;
    }
    #PHP-INFO-END

    #REWRITE-START URL重写规则引用,修改后将导致面板设置的伪静态规则失效
    include /www/server/panel/vhost/rewrite/api.kbitai.com.cn.conf;
    #REWRITE-END

    # 禁止访问的敏感文件
    location ~* (\.user.ini|\.htaccess|\.htpasswd|\.env.*|\.project|\.bashrc|\.bash_profile|\.bash_logout|\.DS_Store|\.gitignore|\.gitattributes|LICENSE|README\.md|CLAUDE\.md|CHANGELOG\.md|CHANGELOG|CONTRIBUTING\.md|TODO\.md|FAQ\.md|composer\.json|composer\.lock|package(-lock)?\.json|yarn\.lock|pnpm-lock\.yaml|\.\w+~|\.swp|\.swo|\.bak(up)?|\.old|\.tmp|\.temp|\.log|\.sql(\.gz)?|docker-compose\.yml|docker\.env|Dockerfile|\.csproj|\.sln|Cargo\.toml|Cargo\.lock|go\.mod|go\.sum|phpunit\.xml|phpunit\.xml|pom\.xml|build\.gradl|pyproject\.toml|requirements\.txt|application(-\w+)?\.(ya?ml|properties))$
    {
        return 404;
    }
    
    # 禁止访问的敏感目录
    location ~* /(\.git|\.svn|\.bzr|\.vscode|\.claude|\.idea|\.ssh|\.github|\.npm|\.yarn|\.pnpm|\.cache|\.husky|\.turbo|\.next|\.nuxt|node_modules|runtime)/ {
        return 404;
    }

    #一键申请SSL证书验证目录相关设置
    location ~ \.well-known{
        allow all;
    }

    #禁止在证书验证目录放入敏感文件
    if ( $uri ~ "^/\.well-known/.*\.(php|jsp|py|js|css|lua|ts|go|zip|tar\.gz|rar|7z|sql|bak)$" ) {
        return 403;
    }

    location ~ .*\.(gif|jpg|jpeg|png|bmp|swf)$
    {
        expires      30d;
        error_log /dev/null;
        access_log /dev/null;
    }

    location ~ .*\.(js|css)?$
    {
        expires      12h;
        error_log /dev/null;
        access_log /dev/null;
    }
    
    access_log  /www/wwwlogs/api.kbitai.com.cn.log;
    error_log  /www/wwwlogs/api.kbitai.com.cn.error.log;
}
```

## 验证步骤

1. **测试 Nginx 配置**：
   ```bash
   nginx -t
   ```

2. **重启 Nginx 服务**：
   ```bash
   systemctl restart nginx
   ```

3. **检查服务状态**：
   ```bash
   systemctl status nginx
   ```

4. **测试访问**：
   - 管理后台：https://api.kbitai.com.cn/admin/index.php
   - API 健康检查：https://api.kbitai.com.cn/api/health

## 如果仍然失败

如果手动修改配置后仍然失败，可以尝试：

1. **使用宝塔面板重新生成配置**：
   - 登录宝塔面板
   - 找到 api.kbitai.com.cn 站点
   - 点击"设置" -> "配置文件"
   - 在 PHP location 块中添加：
     ```nginx
     fastcgi_param HTTP_AUTHORIZATION $http_authorization;
     ```

2. **检查错误日志**：
   ```bash
   tail -f /www/wwwlogs/api.kbitai.com.cn.error.log
   ```

3. **检查 Nginx 错误日志**：
   ```bash
   tail -f /var/log/nginx/error.log
   ```
