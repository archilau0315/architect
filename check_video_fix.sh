#!/bin/bash

# ============================================
# Kbitai 视频功能修复检测脚本 v1.0
# 用途：自动检测所有代码修改和数据修正是否正确
# 运行方式: bash check_video_fix.sh 或 chmod +x check_video_fix.sh && ./check_video_fix.sh
# ============================================

echo "============================================================"
echo "  Kbitai 视频功能修复检测脚本"
echo "  检测时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 统计变量
PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

# ============================================
# 第一部分：后端代码检测
# ============================================
echo -e "${BLUE}[1/5] 检测后端代码修改...${NC}"
echo "------------------------------------------------------------"

# 1.1 检查 ph8TokenService.js 的 deductBalance 函数签名
echo -n "  [1.1] deductBalance函数签名... "
if grep -q "async function deductBalance(userId, cost, nickname, email)" /www/wwwroot/api.kbitai.com.cn/services/ph8TokenService.js 2>/dev/null; then
    echo -e "${GREEN}✓ 通过${NC} (支持4个参数)"
    ((PASS_COUNT++))
else
    echo -e "${RED}✗ 失败${NC} (函数签名不正确)"
    ((FAIL_COUNT++))
fi

# 1.2 检查 ph8.js 费用提取增强逻辑
echo -n "  [1.2] ph8.js费用提取逻辑(6种格式)... "
if grep -q "responseBody.usage.cost" /www/wwwroot/api.kbitai.com.cn/routes/ph8.js 2>/dev/null && \
   grep -q "responseBody.charge" /www/wwwroot/api.kbitai.com.cn/routes/ph8.js 2>/dev/null; then
    echo -e "${GREEN}✓ 通过${NC} (支持多种费用字段)"
    ((PASS_COUNT++))
else
    echo -e "${RED}✗ 失败${NC} (费用提取逻辑不完整)"
    ((FAIL_COUNT++))
fi

# 1.3 检查 totalTokens 数据传递修复
echo -n "  [1.3] totalTokens数据传递修复... "
if grep -q "totalTokens: totalTokens," /www/wwwroot/api.kbitai.com.cn/routes/ph8.js 2>/dev/null; then
    # 确保不是硬编码为0
    if ! grep -A5 "totalTokens: totalTokens," /www/wwwroot/api.kbitai.com.cn/routes/ph8.js | grep -q "totalTokens: 0"; then
        echo -e "${GREEN}✓ 通过${NC} (使用动态变量)"
        ((PASS_COUNT++))
    else
        echo -e "${YELLOW}⚠ 警告${NC} (可能存在硬编码0的情况)"
        ((WARN_COUNT++))
    fi
else
    echo -e "${RED}✗ 失败${NC} (未找到totalTokens传递逻辑)"
    ((FAIL_COUNT++))
fi

# 1.4 检查 PH8 视频费率常量
echo -n "  [1.4] PH8视频费率常量(0.0000042)... "
if grep -q "0.0000042" /www/wwwroot/api.kbitai.com.cn/routes/ph8.js 2>/dev/null; then
    echo -e "${GREEN}✓ 通过${NC} (费率已配置)"
    ((PASS_COUNT++))
else
    echo -e "${YELLOW}⚠ 警告${NC} (未找到标准费率常量)"
    ((WARN_COUNT++))
fi

echo ""

# ============================================
# 第二部分：前端代码检测
# ============================================
echo -e "${BLUE}[2/5] 检测前端代码修改...${NC}"
echo "------------------------------------------------------------"

# 2.1 检查 VideoGenerator.tsx 是否包含 videoBlobService 导入
FRONTEND_DIST="/www/wwwroot/kbitai.com.cn/architect/dist/assets"

echo -n "  [2.1] videoBlobService导入检查... "
if ls $FRONTEND_DIST/index-*.js 1>/dev/null 2>&1; then
    LATEST_JS=$(ls -t $FRONTEND_DIST/index-*.js | head -1)
    if grep -q "videoBlobService" "$LATEST_JS" 2>/dev/null; then
        echo -e "${GREEN}✓ 通过${NC} (已导入videoBlobService)"
        ((PASS_COUNT++))
    else
        echo -e "${RED}✗ 失败${NC} (未找到videoBlobService导入)"
        ((FAIL_COUNT++))
    fi
else
    echo -e "${YELLOW}⚠ 跳过${NC} (未找到前端构建文件)"
    ((WARN_COUNT++))
fi

# 2.2 检查是否有 VITE_VIDEO_API_KEY 错误提示残留
echo -n "  [2.2] VITE_VIDEO_API_KEY错误提示清理... "
if [ -f "$LATEST_JS" ]; then
    if ! grep -q "VITE_VIDEO_API_KEY" "$LATEST_JS" 2>/dev/null; then
        echo -e "${GREEN}✓ 通过${NC} (无残留提示)"
        ((PASS_COUNT++))
    else
        echo -e "${YELLOW}⚠ 警告${NC} (存在VITE_VIDEO_API_KEY相关代码)"
        ((WARN_COUNT++))
    fi
fi

echo ""

# ============================================
# 第三部分：数据库数据检测
# ============================================
echo -e "${BLUE}[3/5] 检测数据库数据修正...${NC}"
echo "------------------------------------------------------------"

# 3.1 检查视频记录总数
echo -n "  [3.1] 视频记录总数查询... "
TOTAL_VIDEOS=$(mysql -u root -p'你的数据库密码' kbitai0302 -se "SELECT COUNT(*) FROM kbit_usage_logs WHERE feature='video_gen';" 2>/dev/null)
if [ $? -eq 0 ] && [ -n "$TOTAL_VIDEOS" ]; then
    echo -e "${GREEN}✓ 通过${NC} (共 ${TOTAL_VIDEOS} 条记录)"
    ((PASS_COUNT++))
else
    echo -e "${RED}✗ 失败${NC} (无法连接数据库或查询失败)"
    ((FAIL_COUNT++))
    TOTAL_VIDEOS=0
fi

# 3.2 检查消耗为0的成功视频记录数
echo -n "  [3.2] 积分为0的成功视频记录数... "
ZERO_COST_SUCCESS=$(mysql -u root -p'你的数据库密码' kbitai0302 -se "SELECT COUNT(*) FROM kbit_usage_logs WHERE feature='video_gen' AND status='success' AND points_cost=0;" 2>/dev/null)
if [ $? -eq 0 ] && [ -n "$ZERO_COST_SUCCESS" ]; then
    if [ "$ZERO_COST_SUCCESS" -eq 0 ]; then
        echo -e "${GREEN}✓ 通过${NC} (无遗漏记录, 全部已修正)"
        ((PASS_COUNT++))
    else
        echo -e "${RED}✗ 失败${NC} (仍有 ${ZERO_COST_SUCCESS} 条未修正)"
        ((FAIL_COUNT++))
    fi
else
    echo -e "${YELLOW}⚠ 跳过${NC} (无法查询)"
    ((WARN_COUNT++))
fi

# 3.3 检查修正后的具体数值
echo -n "  [3.3] 修正后的积分值验证(ID 568,567,553,538,517,500)... "
CORRECTED_RECORDS=$(mysql -u root -p'你的数据库密码' kbitai0302 -se "SELECT COUNT(*) FROM kbit_usage_logs WHERE id IN (568, 567, 553, 538, 517, 500) AND points_cost > 0;" 2>/dev/null)
if [ $? -eq 0 ] && [ -n "$CORRECTED_RECORDS" ]; then
    if [ "$CORRECTED_RECORDS" -eq 6 ]; then
        echo -e "${GREEN}✓ 通过${NC} (6条记录全部修正成功)"
        ((PASS_COUNT++))
        
        # 显示具体的修正值
        echo ""
        echo "      详细修正结果:"
        mysql -u root -p'你的数据库密码' kbitai0302 -e "SELECT id, points_cost AS '积分', actual_cost AS '成本(元)', total_tokens AS 'Token数' FROM kbit_usage_logs WHERE id IN (568, 567, 553, 538, 517, 500) ORDER BY id DESC;" 2>/dev/null | sed 's/^/      /'
    else
        echo -e "${RED}✗ 失败${NC} (仅 ${CORRECTED_RECORDS}/6 条已修正)"
        ((FAIL_COUNT++))
    fi
else
    echo -e "${YELLOW}⚠ 跳过${NC} (无法查询)"
    ((WARN_COUNT++))
fi

# 3.4 检查用户13的余额
echo -n "  [3.4] 用户13(啄之堂)余额检查... "
USER_BALANCE=$(mysql -u root -p'你的数据库密码' kbitai0302 -se "SELECT total_points FROM kbit_users WHERE id=13;" 2>/dev/null)
if [ $? -eq 0 ] && [ -n "$USER_BALANCE" ]; then
    echo -e "${GREEN}✓ 通过${NC} (当前余额: ${USER_BALANCE} 积分)"
    ((PASS_COUNT++))
else
    echo -e "${YELLOW}⚠ 跳过${NC} (无法查询)"
    ((WARN_COUNT++))
fi

echo ""

# ============================================
# 第四部分：服务状态检测
# ============================================
echo -e "${BLUE}[4/5] 检测服务运行状态...${NC}"
echo "------------------------------------------------------------"

# 4.1 检查 PM2 服务状态
echo -n "  [4.1] PM2后端服务(kbitai-api)状态... "
PM2_STATUS=$(pm2 list 2>/dev/null | grep 'kbitai-api' | awk '{print $10}')
if [ "$PM2_STATUS" = "online" ]; then
    echo -e "${GREEN}✓ 通过${NC} (服务运行中)"
    ((PASS_COUNT++))
elif [ "$PM2_STATUS" = "stopped" ]; then
    echo -e "${RED}✗ 失败${NC} (服务已停止)"
    ((FAIL_COUNT++))
else
    echo -e "${YELLOW}⚠ 未知${NC} (状态: ${PM2_STATUS})"
    ((WARN_COUNT++))
fi

# 4.2 检查 Nginx 状态
echo -n "  [4.2 Nginx服务状态... "
if pgrep nginx > /dev/null 2>&1; then
    echo -e "${GREEN}✓ 通过${NC} (Nginx运行中)"
    ((PASS_COUNT++))
else
    echo -e "${RED}✗ 失败${NC} (Nginx未运行)"
    ((FAIL_COUNT++))
fi

# 4.3 检查最近的后端日志是否有视频相关错误
echo -n "  [4.3] 最近视频相关错误日志... "
RECENT_ERRORS=$(pm2 logs kbitai-api --lines 50 --nostream 2>/dev/null | grep -i "error\|failed\|video.*error" | tail -5)
if [ -z "$RECENT_ERRORS" ]; then
    echo -e "${GREEN}✓ 通过${NC} (无近期错误)"
    ((PASS_COUNT++))
else
    echo -e "${YELLOW}⚠ 警告${NC} (发现潜在错误)"
    echo "$RECENT_ERRORS" | sed 's/^/      /'
    ((WARN_COUNT++))
fi

echo ""

# ============================================
# 第五部分：综合测试建议
# ============================================
echo -e "${BLUE}[5/5] 生成测试建议...${NC}"
echo "------------------------------------------------------------"

echo ""
echo -e "${YELLOW}📋 手动测试清单:${NC}"
echo "  1. 打开浏览器访问 https://www.kbitai.com.cn"
echo "  2. 登录测试账号"
echo "  3. 进入视频生成功能"
echo "  4. 生成一个短视频（约30秒）"
echo "  5. 检查:"
echo "     - 是否还有 'videoBlobInstance is not defined' 错误?"
echo "     - 视频是否能正常播放?"
echo "     - 后台管理页面是否显示正确的积分消耗?"
echo "  6. 按 F12 打开开发者工具，查看控制台是否有红色错误"
echo ""

# ============================================
# 结果汇总
# ============================================
echo "============================================================"
echo -e "  ${BLUE}检测结果汇总${NC}"
echo "============================================================"
TOTAL=$((PASS_COUNT + FAIL_COUNT + WARN_COUNT))
echo -e "  总检测项: ${TOTAL}"
echo -e "  ${GREEN}✓ 通过: ${PASS_COUNT}${NC}"
echo -e "  ${RED}✗ 失败: ${FAIL_COUNT}${NC}"
echo -e "  ${YELLOW}⚠ 警告: ${WARN_COUNT}${NC}"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "  ${GREEN}🎉 所有关键检测项通过！可以开始手动测试。${NC}"
    exit 0
else
    echo -e "  ${RED}❌ 存在 ${FAIL_COUNT} 个失败项，请检查上方详细输出。${NC}"
    exit 1
fi
