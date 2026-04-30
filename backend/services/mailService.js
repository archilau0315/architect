const nodemailer = require('nodemailer');

class MailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.126.com',
      port: process.env.SMTP_PORT || 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER || 'kbit_ai@126.com',
        pass: process.env.SMTP_PASS || 'ZYhFb9wk9uHzNM2N'
      }
    });
    this.fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER || 'kbit_ai@126.com';
    this.fromName = process.env.SMTP_FROM_NAME || '首席图像架构师';
  }

  async sendEmail(to, subject, html) {
    try {
      console.log('开始发送邮件到:', to);
      console.log('邮件主题:', subject);
      
      const info = await this.transporter.sendMail({
        from: `${this.fromName} <${this.fromEmail}>`,
        to: to,
        subject: subject,
        html: html
      });
      
      console.log('邮件发送成功，Message ID:', info.messageId);
      return true;
    } catch (error) {
      console.error('邮件发送失败:', error);
      return false;
    }
  }

  async sendPasswordResetEmail(email, tokenOrUsername, resetUrl) {
    const resetLink = resetUrl || `https://www.kbitai.com.cn/architect/?reset=${tokenOrUsername}`;
    const subject = '【首席图像架构师】密码重置请求';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #0f172a; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); color: white; padding: 30px 30px 24px; text-align: center; border-radius: 10px 10px 0 0; }
          .logo-wrap { width: 72px; height: 72px; border-radius: 50%; overflow: hidden; margin: 0 auto 16px; display: block; }
          .logo-wrap img { width: 100%; height: 100%; object-fit: cover; display: block; }
          .header h1 { margin: 0; font-size: 20px; font-weight: 900; letter-spacing: 1px; }
          .header p { margin: 6px 0 0; font-size: 12px; opacity: 0.7; letter-spacing: 2px; text-transform: uppercase; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: linear-gradient(135deg, #4F46E5, #7C3AED); color: white !important; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <span class="logo-wrap"><img src="https://www.kbitai.com.cn/public/archi01.png" alt="KBITAI" /></span>
            <h1>KBITAI Architect</h1>
            <p>首席图像架构师 · 内测版</p>
          </div>
          <div class="content">
            <p>您好，</p>
            <p>我们收到了您的密码重置请求。请点击以下按钮重置您的密码：</p>
            <p style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" class="button">重置密码</a>
            </p>
            <p><strong>注意事项：</strong></p>
            <ul>
              <li>此链接有效期为1小时</li>
              <li>点击链接后，您将进入密码重置页面</li>
              <li>如果您没有请求密码重置，请忽略此邮件</li>
            </ul>
            <div class="footer">
              <p>© 2026 首席图像架构师 | 天津匡形无界智能科技有限公司</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
    return await this.sendEmail(email, subject, html);
  }

  async sendInviteCode(email, inviteCode) {
    const subject = '【KBITAI Architect】内测邀请码';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>内测邀请码</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #1e1b4b; margin: 0; padding: 20px; }
          .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
          .logo-wrap { width: 72px; height: 72px; border-radius: 50%; overflow: hidden; margin: 0 auto 16px; display: block; }
          .logo-wrap img { width: 100%; height: 100%; object-fit: cover; display: block; }
          .header { background: linear-gradient(135deg, #4F46E5, #7C3AED); color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 20px; font-weight: 900; letter-spacing: 1px; }
          .header p { margin: 6px 0 0; font-size: 12px; opacity: 0.8; letter-spacing: 2px; text-transform: uppercase; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .code-box { background: linear-gradient(135deg, #4F46E5, #7C3AED); color: white; padding: 20px 30px; border-radius: 8px; text-align: center; margin: 20px 0; }
          .code-box .label { font-size: 12px; opacity: 0.9; margin-bottom: 8px; }
          .code-box .code { font-size: 28px; font-weight: 900; letter-spacing: 4px; font-family: monospace; }
          .benefits { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .benefits h3 { margin: 0 0 12px; font-size: 14px; color: #1f2937; }
          .benefits ul { margin: 0; padding-left: 20px; font-size: 13px; color: #4b5563; line-height: 1.8; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <span class="logo-wrap"><img src="https://www.kbitai.com.cn/public/archi01.png" alt="KBITAI" /></span>
            <h1>KBITAI Architect</h1>
            <p>首席图像架构师 · 内测版</p>
          </div>
          <div class="content">
            <p>您好，</p>
            <p>恭喜！您的内测申请已通过审核。以下是您的专属邀请码：</p>
            <div class="code-box">
              <div class="label">您的邀请码</div>
              <div class="code">${inviteCode}</div>
            </div>
            <div class="benefits">
              <h3>内测用户权益</h3>
              <ul>
                <li>每日 200 积分，可用于 AI 生图</li>
                <li>注册即送 1000 积分</li>
                <li>图片无水印下载</li>
                <li>优先体验新功能</li>
              </ul>
            </div>
            <p style="font-size: 13px; color: #6b7280;">邀请码有效期为 30 天，请尽快注册使用。</p>
            <p style="text-align: center; margin-top: 24px;">
              <a href="https://www.kbitai.com.cn/architect" style="display: inline-block; background: linear-gradient(135deg, #4F46E5, #7C3AED); color: white !important; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px;">立即体验</a>
            </p>
            <div class="footer">
              <p>© 2026 首席图像架构师 | 天津匡形无界智能科技有限公司</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
    return await this.sendEmail(email, subject, html);
  }
}

module.exports = new MailService();
