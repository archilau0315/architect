#!/bin/bash
# ============================================
# 服务器端同步检查 v4 — 匹配实际部署结构
# 前端: /www/wwwroot/kbitai.com.cn/architect/
# 后端: /www/wwwroot/api.kbitai.com.cn/
# 用法: bash deploy/check-server-sync.sh
# ============================================

set -e

echo "============================================"
echo "  KbitAI Architect - 服务器同步检查"
echo "============================================"
echo ""

FRONT="/www/wwwroot/kbitai.com.cn/architect"
BACKEND="/www/wwwroot/api.kbitai.com.cn"
OUT="$FRONT/deploy/server-file-manifest.txt"

echo "[1/3] 扫描服务器文件..."
echo ""

cat > "$OUT" << 'EOF'
TYPE | PATH | SIZE_KB | MODIFIED | HASH
-----|------|---------|----------|-----
EOF

scan_dir() {
    local base="$1"
    local type="$2"
    if [ -d "$base" ]; then
        find "$base" -type f \( -name "*.html" -o -name "*.js" -o -name "*.css" -o -name "*.mjs" -o -name "*.json" \) ! -path "*/node_modules/*" 2>/dev/null | sort | while read -r f; do
            rel="${f#$base/}"
            kb=$(du -k "$f" | cut -f1)
            mod=$(stat -c %y "$f" 2>/dev/null | cut -d'.' -f1 | sed 's/-//g; s/ /_/g')
            h=$(sha256sum "$f" 2>/dev/null | awk '{print $1}' | head -c 16)
            printf "%-6s | %-55s | %7s | %-19s | %s\n" "$type" "$rel" "$kb" "$mod" "$h"
        done
    else
        echo "  [WARN] 目录不存在: $base" >&2
    fi
}

echo "  扫描前端 architect/ ..."
scan_dir "$FRONT" "frontend" >> "$OUT"

echo "  扫描后端 api.kbitai.com.cn/ ..."
scan_dir "$BACKEND" "backend" >> "$OUT"

echo ""
echo "[2/3] 统计..."

fn=$(grep -c "^frontend" "$OUT" 2>/dev/null || true); fn=${fn:-0}
bn=$(grep -c "^backend" "$OUT" 2>/dev/null || true); bn=${bn:-0}
total=$((fn + bn))

echo ""
echo "  前端(architect) : $fn 个文件"
echo "  后端(api)       : $bn 个文件"
echo "  合计            : $total 个文件"
echo ""
echo "[3/3] 完成!"
echo ""
echo "  清单已保存到: $OUT"
echo ""
echo "--- 最近修改的 20 个文件 ---"
sort -t'|' -k4 -r "$OUT" | head -20
