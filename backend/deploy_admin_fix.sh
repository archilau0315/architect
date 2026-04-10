#!/bin/bash

# 部署管理后台修复脚本
# 确保所有必要的文件都被正确上传到服务器

echo "开始部署管理后台修复..."

# 确保目录结构存在
echo "创建必要的目录结构..."
mkdir -p /www/wwwroot/api.kbitai.com.cn/models/
mkdir -p /www/wwwroot/api.kbitai.com.cn/controllers/
mkdir -p /www/wwwroot/api.kbitai.com.cn/includes/
mkdir -p /www/wwwroot/api.kbitai.com.cn/middleware/
mkdir -p /www/wwwroot/api.kbitai.com.cn/routes/
mkdir -p /www/wwwroot/api.kbitai.com.cn/config/
mkdir -p /www/wwwroot/api.kbitai.com.cn/admin/
mkdir -p /www/wwwroot/api.kbitai.com.cn/storage/cache/
mkdir -p /www/wwwroot/api.kbitai.com.cn/storage/cache/rate_limit/
mkdir -p /www/wwwroot/api.kbitai.com.cn/storage/cache/response/
mkdir -p /www/wwwroot/api.kbitai.com.cn/storage/logs/

# 复制核心文件
echo "复制核心文件..."

# 模型文件
cp -f models/User.php /www/wwwroot/api.kbitai.com.cn/models/
cp -f models/ModelRouter.php /www/wwwroot/api.kbitai.com.cn/models/
cp -f models/CostController.php /www/wwwroot/api.kbitai.com.cn/models/
cp -f models/Subscription.php /www/wwwroot/api.kbitai.com.cn/models/
cp -f models/QuotaManager.php /www/wwwroot/api.kbitai.com.cn/models/

# 控制器文件
cp -f controllers/AdminController.php /www/wwwroot/api.kbitai.com.cn/controllers/
cp -f controllers/AuthController.php /www/wwwroot/api.kbitai.com.cn/controllers/
cp -f controllers/UserController.php /www/wwwroot/api.kbitai.com.cn/controllers/
cp -f controllers/SubscriptionController.php /www/wwwroot/api.kbitai.com.cn/controllers/
cp -f controllers/RoutingController.php /www/wwwroot/api.kbitai.com.cn/controllers/
cp -f controllers/ProxyController.php /www/wwwroot/api.kbitai.com.cn/controllers/

# 核心文件
cp -f includes/Database.php /www/wwwroot/api.kbitai.com.cn/includes/
cp -f includes/JWT.php /www/wwwroot/api.kbitai.com.cn/includes/
cp -f includes/Router.php /www/wwwroot/api.kbitai.com.cn/includes/

# 中间件文件
cp -f middleware/AuthMiddleware.php /www/wwwroot/api.kbitai.com.cn/middleware/
cp -f middleware/Middleware.php /www/wwwroot/api.kbitai.com.cn/middleware/
cp -f middleware/RateLimitMiddleware.php /www/wwwroot/api.kbitai.com.cn/middleware/
cp -f middleware/QuotaMiddleware.php /www/wwwroot/api.kbitai.com.cn/middleware/

# 路由文件
cp -f routes/api.php /www/wwwroot/api.kbitai.com.cn/routes/

# 配置文件
cp -f config/database.php /www/wwwroot/api.kbitai.com.cn/config/
cp -f config/jwt.php /www/wwwroot/api.kbitai.com.cn/config/
cp -f config/system.php /www/wwwroot/api.kbitai.com.cn/config/

# 管理后台文件
cp -f admin/index.php /www/wwwroot/api.kbitai.com.cn/admin/
cp -f admin/dashboard.php /www/wwwroot/api.kbitai.com.cn/admin/
cp -f admin/users.php /www/wwwroot/api.kbitai.com.cn/admin/
cp -f admin/beta.php /www/wwwroot/api.kbitai.com.cn/admin/
cp -f admin/models.php /www/wwwroot/api.kbitai.com.cn/admin/
cp -f admin/logs.php /www/wwwroot/api.kbitai.com.cn/admin/

# 主入口文件
cp -f index.php /www/wwwroot/api.kbitai.com.cn/

# 设置文件权限
echo "设置文件权限..."
find /www/wwwroot/api.kbitai.com.cn -type f -name "*.php" -exec chmod 755 {} \;
find /www/wwwroot/api.kbitai.com.cn -type d -exec chmod 755 {} \;

# 确保storage目录可写
chmod -R 775 /www/wwwroot/api.kbitai.com.cn/storage/

echo "部署完成！"
echo "请确保数据库中存在必要的表结构："
echo "1. admins 表"
echo "2. users 表"
echo "3. system_config 表"
echo "4. token_blacklist 表"
echo ""
echo "管理后台访问地址：https://api.kbitai.com.cn/admin/index.php"
echo "用户名: admin"
echo "密码: admin123"
