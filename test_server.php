<?php
/**
 * 简单的服务器测试文件
 */
echo "服务器测试";
echo "<br>当前目录: " . __DIR__;
echo "<br>服务器根目录: " . $_SERVER['DOCUMENT_ROOT'];
echo "<br>请求URI: " . $_SERVER['REQUEST_URI'];
?>