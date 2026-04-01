#!/bin/bash
# 修复管理员登录404错误 - 部署脚本

echo "=== 修复 /api/admin/login 404错误 ==="

# 1. 备份当前配置
echo "[1/4] 备份当前配置..."
cp /www/server/panel/vhost/nginx/www.kbitai.com.cn.conf /www/server/panel/vhost/nginx/www.kbitai.com.cn.conf.bak.$(date +%Y%m%d_%H%M%S)

# 2. 上传新配置
echo "[2/4] 上传新配置文件..."
echo "请将 www.kbitai.com.cn.conf.fixed 上传到服务器"
echo "然后运行: cp www.kbitai.com.cn.conf.fixed /www/server/panel/vhost/nginx/www.kbitai.com.cn.conf"

# 3. 测试nginx配置
echo "[3/4] 测试nginx配置..."
nginx -t

# 4. 重载nginx
if [ $? -eq 0 ]; then
    echo "[4/4] 重载nginx..."
    nginx -s reload
    echo "✓ 修复完成！"
    echo "现在可以访问 https://www.kbitai.com.cn/admin/ 登录了"
else
    echo "✗ nginx配置测试失败，请检查配置文件"
    exit 1
fi
