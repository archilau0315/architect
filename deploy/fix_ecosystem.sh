#!/bin/bash
# 修改 ecosystem.config.js，移除数据库配置

cat > /www/wwwroot/api.kbitai.com.cn/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'kbitai-api',
    script: '/www/wwwroot/api.kbitai.com.cn/server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
EOF

echo "ecosystem.config.js 已更新"
pm2 restart kbitai-api
echo "服务已重启"
