<?php
// 生成密码哈希
$password = 'admin123';
$hash = password_hash($password, PASSWORD_DEFAULT);
echo "密码: $password\n";
echo "哈希: $hash\n";
?>
