#!/bin/bash
# 批量修改数据库表引用

API_DIR="/www/wwwroot/api.kbitai.com.cn"

echo "修改 server.js..."
sed -i 's/FROM users/FROM kbit_users/g' "$API_DIR/server.js"
sed -i 's/UPDATE users/UPDATE kbit_users/g' "$API_DIR/server.js"
sed -i 's/INTO users/INTO kbit_users/g' "$API_DIR/server.js"
sed -i 's/user_id = ?/id = ?/g' "$API_DIR/server.js"
sed -i 's/user_id:/id:/g' "$API_DIR/server.js"
sed -i 's/user\.user_id/user\.id/g' "$API_DIR/server.js"

echo "修改 routes/ph8.js..."
sed -i 's/FROM users/FROM kbit_users/g' "$API_DIR/routes/ph8.js"
sed -i 's/UPDATE users/UPDATE kbit_users/g' "$API_DIR/routes/ph8.js"

echo "修改 routes/invite.js..."
sed -i 's/FROM users/FROM kbit_users/g' "$API_DIR/routes/invite.js"

echo "修改 middleware/usageLimiter.js..."
sed -i 's/FROM users/FROM kbit_users/g' "$API_DIR/middleware/usageLimiter.js"

echo "修改 services/ph8TokenService.js..."
sed -i 's/FROM users/FROM kbit_users/g' "$API_DIR/services/ph8TokenService.js"

echo "完成！"
