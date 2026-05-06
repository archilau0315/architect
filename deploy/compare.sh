#!/bin/bash
# 对比脚本 v2 — 自动剥离路径前缀再比较

LOCAL="/www/wwwroot/kbitai.com.cn/architect/deploy/local-file-manifest.txt"
SERVER="/www/wwwroot/kbitai.com.cn/architect/deploy/server-file-manifest.txt"

echo "============================================"
echo "  同步状态对比报告 v2"
echo "============================================"
echo ""

# 提取 path+hash，去掉 dist/ 或 backend/ 前缀（本地有这些前缀，服务器没有）
awk -F'|' 'NR>2 && $2~/.+/ {
    gsub(/^[ \t]+|[ \t]+$/,"",$2)
    gsub(/^[ \t]+|[ \t]+$/,"",$5)
    # 去掉 dist/ 或 backend/ 前缀
    sub(/^dist\//,"",$2)
    sub(/^backend\//,"",$2)
    print $2"|"$5
}' "$LOCAL" > /tmp/local_hash.txt

awk -F'|' 'NR>2 && $2~/.+/ {
    gsub(/^[ \t]+|[ \t]+$/,"",$2)
    gsub(/^[ \t]+|[ \t]+$/,"",$5)
    print $2"|"$5
}' "$SERVER" > /tmp/server_hash.txt

echo "--- 只在服务器有（本地没有 = 不需要处理）---"
comm -23 <(sort /tmp/server_hash.txt) <(sort /tmp/local_hash.txt)
echo ""

echo "--- 只在本地有（需要上传到服务器）---"
comm -13 <(sort /tmp/server_hash.txt) <(sort /tmp/local_hash.txt)
echo ""

echo "--- HASH 不同（内容已变，需重新上传）---"
diff_found=0
join -t'|' -1 1 -2 1 <(sort /tmp/local_hash.txt) <(sort /tmp/server_hash.txt) 2>/dev/null | while IFS='|' read -r f l h; do
    if [ "$l" != "$h" ]; then
        echo "  [需上传] $f"
        echo "           本地=$l  服务=$h"
        diff_found=1
    fi
done
echo ""
echo "============================================"
