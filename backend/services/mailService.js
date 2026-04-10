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

  async sendPasswordResetEmail(email, resetToken) {
    const resetLink = `https://www.kbitai.com.cn/architect/?reset=${resetToken}`;
    const subject = '【首席图像架构师】密码重置请求';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔒 密码重置请求</h1>
          </div>
          <div class="content">
            <p>您好，</p>
            <p>我们收到了您的密码重置请求。请点击以下链接重置您的密码：</p>
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
}

module.exports = new MailService();
