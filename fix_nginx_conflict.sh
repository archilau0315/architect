#!/bin/bash
# ============================================
# Nginx 配置冲突修复脚本
# 修复 server_name "_" 重复定义的问题
# ============================================

echo "=== 开始修复 Nginx 配置冲突 ==="

# 1. 修复 default.conf
echo "1. 修复 0.default.conf..."
sed -i 's/server_name _;/server_name default_server;/' /www/server/panel/vhost/nginx/0.default.conf
echo "   ✓ 已将 server_name _ 修改为 server_name default_server"

# 2. 修复 phpmyadmin.conf
echo "2. 修复 phpmyadmin.conf..."
sed -i 's/server_name _;/server_name phpmyadmin;/' /www/server/panel/vhost/nginx/phpmyadmin.conf
echo "   ✓ 已将 server_name _ 修改为 server_name phpmyadmin"

# 3. 检查并删除备份文件
echo "3. 删除多余的备份文件..."
rm -f /www/server/panel/vhost/nginx/*.bak
rm -f /www/server/panel/vhost/nginx/*.backup
rm -f /www/server/panel/vhost/nginx/*.swp
echo "   ✓ 已删除所有 .bak, .backup, .swp 文件"

# 4. 验证配置
echo "4. 验证 Nginx 配置..."
nginx -t
if [ $? -eq 0 ]; then
    echo "   ✓ Nginx 配置验证通过"
    
    # 5. 重新加载配置
    echo "5. 重新加载 Nginx..."
    nginx -s reload
    echo "   ✓ Nginx 配置已重新加载"
    
    echo ""
    echo "=== 修复完成 ==="
    echo "服务器名冲突警告已解决！"
else
    echo "   ✗ Nginx 配置验证失败，请检查错误信息"
    exit 1
fi