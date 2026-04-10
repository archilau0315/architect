# 管理后台修复指南

## 问题分析

根据错误信息和网络请求分析，管理后台目前存在以下问题：

1. **500 Internal Server Error** - 服务器找不到 `KbitArchitect\Models\User` 类
2. **401 Unauthorized** - 认证失败，可能是Authorization头没有正确传递
3. **404 Not Found** - 某些管理后台页面无法访问

## 解决方案

### 步骤1：上传必要的文件

将以下文件上传到服务器的 `/www/wwwroot/api.kbitai.com.cn/` 目录：

1. **核心模型文件**：
   - `models/User.php`
   - `models/ModelRouter.php`
   - `models/CostController.php`
   - `models/Subscription.php`
   - `models/QuotaManager.php`

2. **控制器文件**：
   - `controllers/AdminController.php`
   - `controllers/AuthController.php`
   - `controllers/UserController.php`
   - `controllers/SubscriptionController.php`
   - `controllers/RoutingController.php`
   - `controllers/ProxyController.php`

3. **核心文件**：
   - `includes/Database.php`
   - `includes/JWT.php`
   - `includes/Router.php`

4. **中间件文件**：
   - `middleware/AuthMiddleware.php`
   - `middleware/Middleware.php`
   - `middleware/RateLimitMiddleware.php`
   - `middleware/QuotaMiddleware.php`

5. **路由文件**：
   - `routes/api.php`

6. **配置文件**：
   - `config/database.php`
   - `config/jwt.php`
   - `config/system.php`

7. **管理后台文件**：
   - `admin/index.php`
   - `admin/dashboard.php`
   - `admin/users.php`
   - `admin/beta.php`
   - `admin/models.php`
   - `admin/logs.php`

8. **主入口文件**：
   - `index.php`

9. **测试文件**：
   - `test_server_files.php`

### 步骤2：修复nginx配置

编辑服务器上的nginx配置文件，确保：

1. 在 `location ~ \.php$` 块中添加：
   ```nginx
   fastcgi_param HTTP_AUTHORIZATION $http_authorization;
   ```

2. 确保根目录设置正确：
   ```nginx
   root /www/wwwroot/api.kbitai.com.cn;
   ```

3. 确保index文件设置正确：
   ```nginx
   index index.php index.html index.htm default.php default.htm default.html;
   ```

### 步骤3：设置文件权限

在服务器上执行以下命令：

```bash
# 设置PHP文件权限
find /www/wwwroot/api.kbitai.com.cn -type f -name "*.php" -exec chmod 755 {} \;

# 设置目录权限
find /www/wwwroot/api.kbitai.com.cn -type d -exec chmod 755 {} \;

# 确保storage目录可写
chmod -R 775 /www/wwwroot/api.kbitai.com.cn/storage/
```

### 步骤4：测试服务器文件结构

在浏览器中访问：
```
https://api.kbitai.com.cn/test_server_files.php
```

这将测试服务器上的文件结构和类加载情况。

### 步骤5：测试管理后台登录

1. 访问管理后台登录页面：
   ```
   https://api.kbitai.com.cn/admin/index.php
   ```

2. 使用以下凭据登录：
   - 用户名：admin
   - 密码：admin123

### 步骤6：验证功能

登录后，验证以下功能是否正常：

1. **仪表盘** - 查看系统统计信息
2. **用户管理** - 查看和管理用户
3. **内测申请** - 查看和处理内测申请
4. **系统配置** - 查看和修改系统配置
5. **使用日志** - 查看系统使用日志

## 常见问题解决

### 1. 500 Internal Server Error

**原因**：服务器找不到必要的类文件。

**解决方案**：
- 确保所有必要的文件都已上传到正确的位置
- 确保文件权限正确
- 检查服务器错误日志获取详细信息

### 2. 401 Unauthorized

**原因**：Authorization头没有正确传递到PHP。

**解决方案**：
- 确保nginx配置中添加了 `fastcgi_param HTTP_AUTHORIZATION $http_authorization;`
- 重启nginx服务

### 3. 404 Not Found

**原因**：文件路径不正确或文件不存在。

**解决方案**：
- 确保所有文件都已上传到正确的位置
- 检查nginx配置中的根目录设置
- 确保文件权限正确

### 4. 数据库连接错误

**原因**：数据库配置不正确或数据库连接失败。

**解决方案**：
- 检查 `.env` 文件中的数据库配置
- 确保数据库服务正在运行
- 确保数据库用户有正确的权限

## 技术支持

如果您在修复过程中遇到任何问题，请联系技术支持。

---

**注意**：请在生产环境中修改默认密码，确保系统安全。
