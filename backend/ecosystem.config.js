module.exports = {
  apps: [{
    name: 'kbitai-api',
    script: '/www/wwwroot/api.kbitai.com.cn/server.js',
    cwd: '/www/wwwroot/api.kbitai.com.cn',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      DB_HOST: 'localhost',
      DB_USERNAME: 'kbitai0302',
      DB_PASSWORD: 'kbitai2026',
      DB_DATABASE: 'kbitai0302',
      DB_PORT: '3306',
      PORT: '3001',
      JWT_SECRET: 'kbitai-architect-2026-secret-key-change-this',
      GEMINI_API_KEY: '你的Gemini密钥',
      PH8_API_KEY: 'sk-2f6ff8aba4d541d591d17e8eae60e75c',
      PH8_GATEWAY_URL: 'https://ph8.co',
      PH8_ENABLED: 'true',
      SMTP_HOST: 'smtp.126.com',
      SMTP_PORT: '465',
      SMTP_USER: 'kbit_ai@126.com',
      SMTP_PASS: 'ZYhFb9wk9uHzNM2N',
      SMTP_FROM: 'kbit_ai@126.com',
      SMTP_FROM_NAME: '首席图像架构师'
    }
  }]
};
