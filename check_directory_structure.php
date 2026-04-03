<?php
/**
 * 服务器目录结构检查脚本
 * 用于检查服务器上的目录结构，找到bankend目录的位置
 */

echo "=== 服务器目录结构检查 ===\n\n";

// 检查根目录
echo "1. 检查网站根目录结构:\n";
$rootDir = '/www/wwwroot/kbitai.com.cn/';
if (is_dir($rootDir)) {
    echo "   ✅ 根目录存在: $rootDir\n";
    $files = scandir($rootDir);
    echo "   内容: " . implode(', ', array_diff($files, ['.', '..'])) . "\n";
} else {
    echo "   ❌ 根目录不存在: $rootDir\n";
}

// 检查architect目录
echo "\n2. 检查architect目录结构:\n";
$architectDir = $rootDir . 'architect/';
if (is_dir($architectDir)) {
    echo "   ✅ architect目录存在: $architectDir\n";
    $files = scandir($architectDir);
    echo "   内容: " . implode(', ', array_diff($files, ['.', '..'])) . "\n";
} else {
    echo "   ❌ architect目录不存在: $architectDir\n";
}

// 搜索bankend目录
echo "\n3. 搜索bankend目录:\n";
$output = shell_exec('find /www/wwwroot/ -name "bankend" -type d 2>/dev/null');
if ($output) {
    echo "   ✅ 找到bankend目录:\n";
    echo $output;
} else {
    echo "   ❌ 未找到bankend目录\n";
}

// 检查api.kbitai.com.cn目录
echo "\n4. 检查api.kbitai.com.cn目录:\n";
$apiDir = '/www/wwwroot/api.kbitai.com.cn/';
if (is_dir($apiDir)) {
    echo "   ✅ api目录存在: $apiDir\n";
    $files = scandir($apiDir);
    echo "   内容: " . implode(', ', array_diff($files, ['.', '..'])) . "\n";
} else {
    echo "   ❌ api目录不存在: $apiDir\n";
}

echo "\n=== 检查完成 ===\n";
?>