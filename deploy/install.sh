#!/bin/bash

echo "=========================================="
echo "首席图像架构师 - 子应用部署脚本"
echo "版本: 1.0.0"
echo "公司: 天津匡形无界智能科技有限公司"
echo "部署路径: www.kbitai.com.cn/architect/"
echo "=========================================="

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

DEPLOY_DIR="/www/wwwroot/kbitai.com.cn/architect"

check_requirements() {
    print_info "检查系统环境..."
    
    if ! command -v php &> /dev/null; then
        print_error "PHP 未安装"
        exit 1
    fi
    
    PHP_VERSION=$(php -r "echo PHP_VERSION;")
    print_info "PHP 版本: $PHP_VERSION"
    
    if ! command -v mysql &> /dev/null; then
        print_warn "MySQL 客户端未找到，请确保 MySQL 服务已安装"
    fi
    
    print_info "检查 PHP 扩展..."
    php -m | grep -E 'pdo|pdo_mysql|json|mbstring' || print_warn "部分 PHP 扩展可能缺失"
}

create_directories() {
    print_info "创建部署目录..."
    
    mkdir -p "$DEPLOY_DIR"
    mkdir -p "$DEPLOY_DIR/backend/storage/cache/rate_limit"
    mkdir -p "$DEPLOY_DIR/backend/storage/cache/response"
    mkdir -p "$DEPLOY_DIR/backend/storage/logs"
    mkdir -p "$DEPLOY_DIR/admin"
    
    print_info "目录创建完成: $DEPLOY_DIR"
}

create_env_file() {
    print_info "创建环境配置文件..."
    
    if [ ! -f "$DEPLOY_DIR/backend/.env" ]; then
        cat > "$DEPLOY_DIR/backend/.env" << EOF
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=kbit_architect
DB_USERNAME=root
DB_PASSWORD=your_password_here

# JWT配置
JWT_SECRET=kbit-jwt-secret-$(openssl rand -hex 32)

# 加密密钥
ENCRYPTION_KEY=kbit-encryption-$(openssl rand -hex 16)

# 应用配置
APP_DEBUG=false
EOF
        print_info ".env 文件已创建，请修改数据库密码"
    else
        print_info ".env 文件已存在"
    fi
}

setup_database() {
    print_info "设置数据库..."
    
    read -p "请输入 MySQL 用户名 [root]: " DB_USER
    DB_USER=${DB_USER:-root}
    
    read -sp "请输入 MySQL 密码: " DB_PASS
    echo
    
    read -p "请输入数据库名 [kbit_architect]: " DB_NAME
    DB_NAME=${DB_NAME:-kbit_architect}
    
    print_info "创建数据库..."
    mysql -u"$DB_USER" -p"$DB_PASS" -e "CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" || {
        print_error "数据库创建失败"
        exit 1
    }
    
    print_info "导入数据库结构..."
    mysql -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" < database/schema.sql || {
        print_error "数据库结构导入失败"
        exit 1
    }
    
    print_info "数据库设置完成"
}

copy_files() {
    print_info "复制文件到部署目录..."
    
    # 复制后端文件
    if [ -d "backend" ]; then
        cp -r backend/* "$DEPLOY_DIR/backend/"
        print_info "后端文件复制完成"
    fi
    
    # 复制管理后台
    if [ -d "admin" ]; then
        cp -r admin/* "$DEPLOY_DIR/admin/"
        print_info "管理后台复制完成"
    fi
    
    # 复制前端构建产物
    if [ -d "dist" ]; then
        cp -r dist/* "$DEPLOY_DIR/"
        print_info "前端文件复制完成"
    else
        print_warn "dist 目录不存在，请先运行 npm run build"
    fi
}

setup_permissions() {
    print_info "设置文件权限..."
    
    chmod -R 755 "$DEPLOY_DIR/backend/storage"
    chown -R www:www "$DEPLOY_DIR/backend/storage" 2>/dev/null || chown -R nginx:nginx "$DEPLOY_DIR/backend/storage" 2>/dev/null || true
    
    print_info "权限设置完成"
}

configure_nginx() {
    print_info "Nginx 配置说明..."
    
    echo ""
    echo "请将以下配置添加到主站 Nginx 配置文件:"
    echo "配置文件路径: /www/server/panel/vhost/nginx/www.kbitai.com.cn.conf"
    echo ""
    echo "配置内容请参考: deploy/nginx.conf"
    echo ""
    echo "添加配置后执行: nginx -s reload"
}

build_frontend() {
    print_info "构建前端..."
    
    if command -v npm &> /dev/null; then
        npm install
        npm run build
        
        print_info "前端构建完成"
    else
        print_warn "npm 未安装，跳过前端构建"
    fi
}

print_summary() {
    echo ""
    echo "=========================================="
    echo "部署完成！"
    echo "=========================================="
    echo ""
    echo "访问地址:"
    echo "  前端应用: https://www.kbitai.com.cn/architect/"
    echo "  管理后台: https://www.kbitai.com.cn/architect/admin/"
    echo "  API接口:  https://www.kbitai.com.cn/architect/backend/api/"
    echo ""
    echo "后续步骤:"
    echo "1. 修改 $DEPLOY_DIR/backend/.env 中的数据库密码"
    echo "2. 将 deploy/nginx.conf 配置合并到主站 Nginx 配置"
    echo "3. 重启 Nginx: nginx -s reload"
    echo "4. 访问管理后台: https://www.kbitai.com.cn/architect/admin/"
    echo "5. 默认管理员账号: admin / admin123"
    echo ""
    echo "请及时修改管理员密码！"
    echo "=========================================="
}

main() {
    check_requirements
    create_directories
    
    read -p "是否设置数据库? [y/N]: " SETUP_DB
    if [[ "$SETUP_DB" =~ ^[Yy]$ ]]; then
        setup_database
    fi
    
    read -p "是否构建前端? [y/N]: " BUILD_FE
    if [[ "$BUILD_FE" =~ ^[Yy]$ ]]; then
        build_frontend
    fi
    
    copy_files
    create_env_file
    setup_permissions
    configure_nginx
    
    print_summary
}

main
