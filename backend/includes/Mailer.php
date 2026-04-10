<?php
/**
 * 邮件发送类
 */

namespace KbitArchitect\Core;

class Mailer
{
    private string $smtpHost;
    private int $smtpPort;
    private string $smtpUser;
    private string $smtpPass;
    private string $fromEmail;
    private string $fromName;

    public function __construct()
    {
        // 直接读取 .env 文件
        $envFile = __DIR__ . '/../.env';
        if (file_exists($envFile)) {
            $lines = file($envFile);
            foreach ($lines as $line) {
                $line = trim($line);
                if (strpos($line, '=') !== false && strpos($line, '#') !== 0) {
                    list($key, $value) = explode('=', $line, 2);
                    $key = trim($key);
                    $value = trim($value, " \t\n\r\0\x0B\"'");
                    $_ENV[$key] = $value;
                }
            }
        }

        $this->smtpHost = $_ENV['SMTP_HOST'] ?? 'smtp.126.com';
        $this->smtpPort = (int)($_ENV['SMTP_PORT'] ?? 465);
        $this->smtpUser = $_ENV['SMTP_USER'] ?? 'kbit_ai@126.com';
        $this->smtpPass = $_ENV['SMTP_PASS'] ?? 'ZYhFb9wk9uHzNM2N';
        $this->fromEmail = $_ENV['SMTP_FROM'] ?? $this->smtpUser;
        $this->fromName = $_ENV['SMTP_FROM_NAME'] ?? '首席图像架构师';
    }

    public function send(string $to, string $subject, string $body): bool
    {
        error_log("开始发送邮件到: $to");
        error_log("邮件主题: $subject");
        error_log("SMTP 主机: " . $this->smtpHost);
        error_log("SMTP 端口: " . $this->smtpPort);
        error_log("SMTP 用户: " . $this->smtpUser);
        
        // 使用 SMTP 发送邮件
        $socket = stream_socket_client(
            'ssl://' . $this->smtpHost . ':' . $this->smtpPort,
            $errno,
            $errstr,
            30
        );
        
        if (!$socket) {
            error_log("SMTP 连接失败: $errstr ($errno)");
            return false;
        }
        
        error_log("SMTP 连接成功");
        
        // 读取服务器欢迎信息
        $response = fgets($socket, 4096);
        error_log("服务器欢迎: $response");
        
        // SMTP 命令列表
        $commands = [
            "EHLO " . gethostname(),
            "AUTH LOGIN",
            base64_encode($this->smtpUser),
            base64_encode($this->smtpPass),
            "MAIL FROM: <" . $this->fromEmail . ">",
            "RCPT TO: <" . $to . ">",
            "DATA"
        ];
        
        foreach ($commands as $command) {
            error_log("发送命令: " . substr($command, 0, 50));
            fwrite($socket, $command . "\r\n");
            
            // 读取完整响应（处理多行响应）
            $response = '';
            $line = fgets($socket, 4096);
            $response .= $line;
            // 如果响应行以 - 结尾，说明还有后续行
            while (substr($line, 3, 1) === '-') {
                $line = fgets($socket, 4096);
                $response .= $line;
            }
            error_log("收到响应: " . substr($response, 0, 200));
            
            // DATA 命令返回 354 或 250 表示可以开始发送数据
            if ($command === "DATA") {
                $responseCode = substr($response, 0, 3);
                if ($responseCode !== '354' && $responseCode !== '250') {
                    error_log("DATA 命令失败, 响应: $response");
                    fclose($socket);
                    return false;
                }
                // 发送邮件内容
                $emailContent = "Subject: " . $subject . "\r\n";
                $emailContent .= "From: " . $this->fromName . " <" . $this->fromEmail . ">\r\n";
                $emailContent .= "To: <" . $to . ">\r\n";
                $emailContent .= "MIME-Version: 1.0\r\n";
                $emailContent .= "Content-Type: text/html; charset=UTF-8\r\n";
                $emailContent .= "\r\n";
                $emailContent .= $body . "\r\n.";
                
                error_log("发送邮件内容...");
                fwrite($socket, $emailContent . "\r\n");
                
                // 读取邮件内容发送响应
                $response = '';
                $line = fgets($socket, 4096);
                $response .= $line;
                while (substr($line, 3, 1) === '-') {
                    $line = fgets($socket, 4096);
                    $response .= $line;
                }
                error_log("邮件内容响应: " . substr($response, 0, 200));
                
                if (substr($response, 0, 3) !== '250') {
                    error_log("邮件内容发送失败, 响应: $response");
                    fclose($socket);
                    return false;
                }
            } elseif (substr($response, 0, 1) != '2' && substr($response, 0, 1) != '3') {
                error_log("SMTP 命令失败: " . substr($command, 0, 30) . ", 响应: $response");
                fclose($socket);
                return false;
            }
        }
        
        // 发送 QUIT 命令
        fwrite($socket, "QUIT\r\n");
        fgets($socket, 4096);
        
        fclose($socket);
        error_log("邮件发送成功");
        return true;
    }

    public function sendBetaApproval(string $email, string $password, string $inviteCode = ''): bool
    {
        $subject = '【首席图像架构师】内测申请已通过';
        $body = $this->getBetaApprovalTemplate($email, $password, $inviteCode);
        return $this->send($email, $subject, $body);
    }

    private function getBetaApprovalTemplate(string $email, string $password, string $inviteCode = ''): string
    {
        $inviteCodeSection = '';
        if (!empty($inviteCode)) {
            $inviteCodeSection = <<<HTML
            <div class="info-box">
                <h3>邀请码</h3>
                <p><strong>邀请码：</strong> {$inviteCode}</p>
                <p><strong>有效期：</strong> 30天</p>
                <p><strong>使用方法：</strong> 分享给朋友，可获得额外积分奖励</p>
            </div>
HTML;
        }
        
        return <<<HTML
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
        .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4F46E5; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 恭喜！内测申请已通过</h1>
        </div>
        <div class="content">
            <p>您好，</p>
            <p>您的内测申请已通过审核，欢迎加入首席图像架构师内测计划！</p>

            <div class="info-box">
                <h3>登录信息</h3>
                <p><strong>登录地址：</strong> <a href="https://www.kbitai.com.cn/architect/">https://www.kbitai.com.cn/architect/</a></p>
                <p><strong>邮箱账号：</strong> {$email}</p>
                <p><strong>初始密码：</strong> {$password}</p>
            </div>

            {$inviteCodeSection}

            <p><strong>温馨提示：</strong></p>
            <ul>
                <li>请妥善保管您的账号密码</li>
                <li>建议首次登录后立即修改密码</li>
                <li>如有任何问题，请联系我们</li>
            </ul>

            <div class="footer">
                <p>© 2026 首席图像架构师 | 天津匡形无界智能科技有限公司</p>
            </div>
        </div>
    </div>
</body>
</html>
HTML;
    }
}

