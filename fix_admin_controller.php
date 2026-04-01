<?php
/**
 * 修复AdminController.php文件
 */

$filePath = __DIR__ . '/controllers/AdminController.php';

if (!file_exists($filePath)) {
    echo "文件不存在: $filePath\n";
    exit(1);
}

$content = file_get_contents($filePath);

// 修复字段名
$content = str_replace("'password_hash' =>", "'password' =>", $content);
$content = str_replace("'status' => 'active'", "'status' => 1", $content);

// 修复用户创建逻辑
$oldCode = <<<'EOF'
            if (!$existingUser) {
                // 创建新用户
                $user_id = uniqid('user_');
                $this->db->insert('users', [
                    'user_id' => $user_id,
                    'email' => $requestData['email'],
                    'password' => password_hash('beta123', PASSWORD_DEFAULT),
                    'tier' => 'basic',
                    'daily_points' => 100,
                    'status' => 1,
                    'created_at' => date('Y-m-d H:i:s'),
                    'updated_at' => date('Y-m-d H:i:s')
                ]);
                $userId = $user_id;
            }
EOF;

$newCode = <<<'EOF'
            if (!$existingUser) {
                // 创建新用户
                $this->db->insert('users', [
                    'email' => $requestData['email'],
                    'password' => password_hash('beta123', PASSWORD_DEFAULT),
                    'tier' => 'basic',
                    'daily_points' => 100,
                    'status' => 1,
                    'created_at' => date('Y-m-d H:i:s'),
                    'updated_at' => date('Y-m-d H:i:s')
                ]);
                // 获取刚插入的用户ID
                $userId = $this->db->queryOne('SELECT user_id FROM users WHERE email = ?', [$requestData['email']])['user_id'];
            }
EOF;

$content = str_replace($oldCode, $newCode, $content);

// 保存文件
if (file_put_contents($filePath, $content)) {
    echo "✅ 修复AdminController.php成功\n";
} else {
    echo "❌ 修复AdminController.php失败\n";
}

// 修复时间显示问题
echo "\n修复时间显示问题...\n";

$filesToFix = [
    'admin/beta.php',
    'admin/dashboard.php',
    'admin/logs.php'
];

foreach ($filesToFix as $file) {
    $filePath = __DIR__ . '/' . $file;
    if (file_exists($filePath)) {
        $content = file_get_contents($filePath);
        $content = str_replace('new Date(request.applied_at).toLocaleString()', 'new Date(request.applied_at.replace(" ", "T")).toLocaleString()', $content);
        $content = str_replace('new Date(log.created_at).toLocaleString()', 'new Date(log.created_at.replace(" ", "T")).toLocaleString()', $content);
        if (file_put_contents($filePath, $content)) {
            echo "✅ 修复 $file 成功\n";
        } else {
            echo "❌ 修复 $file 失败\n";
        }
    } else {
        echo "⚠️ 文件不存在: $file\n";
    }
}

echo "\n修复完成！";
