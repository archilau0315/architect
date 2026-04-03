@echo off

:: 同步脚本 - 将本地代码上传到服务器
:: 注意：需要安装WinSCP和PuTTY工具

set SERVER=kbitai0302
set USER=root
set REMOTE_DIR=/www/wwwroot/kbitai.com.cn/architect
set LOCAL_DIR=%cd%

echo 开始同步代码到服务器...
echo 本地目录: %LOCAL_DIR%
echo 远程目录: %USER%@%SERVER%:%REMOTE_DIR%

:: 使用WinSCP同步文件
echo 正在同步代码文件...
"C:\Program Files (x86)\WinSCP\WinSCP.com" ^
  /command "open sftp://%USER%@%SERVER%/" ^
  "synchronize remote -delete -exclude=node_modules -exclude=.git -exclude=.trae -exclude=*.log "%LOCAL_DIR%" "%REMOTE_DIR%"" ^
  "exit"

if %errorlevel% equ 0 (
    echo 代码同步成功!
    
    :: 同步nginx配置文件
    echo 同步nginx配置文件...
    "C:\Program Files (x86)\WinSCP\WinSCP.com" ^
      /command "open sftp://%USER%@%SERVER%/" ^
      "put "%LOCAL_DIR%\www.kbitai.com.cn.conf" /www/server/panel/vhost/nginx/" ^
      "exit"
    
    if %errorlevel% equ 0 (
        echo Nginx配置同步成功!
        
        :: 使用PuTTY重启服务
        echo 重启Nginx服务...
        "C:\Program Files (x86)\PuTTY\plink.exe" %USER%@%SERVER% "service nginx restart"
        
        echo 重启PHP服务...
        "C:\Program Files (x86)\PuTTY\plink.exe" %USER%@%SERVER% "service php-fpm-82 restart"
        
        echo.
        echo 同步完成！
        echo 网站应该已经可以正常访问了
    ) else (
        echo Nginx配置同步失败
    )
) else (
    echo 代码同步失败
)

echo.
echo 按任意键退出...
pause > nul