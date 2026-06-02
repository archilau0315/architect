require('dotenv').config();

const paymentConfig = {
  wechat: {
    appId: process.env.WECHAT_APP_ID || '',
    mchId: process.env.WECHAT_MCH_ID || '',
    apiKey: process.env.WECHAT_API_KEY || '',
    apiKeyV3: process.env.WECHAT_API_KEY_V3 || '',
    serialNo: process.env.WECHAT_SERIAL_NO || '',
    privateKey: process.env.WECHAT_PRIVATE_KEY || '',
    notifyUrl: process.env.WECHAT_NOTIFY_URL || 'https://api.kbitai.com.cn/api/payment/wechat-notify',
  },
  alipay: {
    appId: process.env.ALIPAY_APP_ID || '',
    privateKey: process.env.ALIPAY_PRIVATE_KEY || '',
    alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY || '',
    notifyUrl: process.env.ALIPAY_NOTIFY_URL || 'https://api.kbitai.com.cn/api/payment/alipay-notify',
    returnUrl: process.env.ALIPAY_RETURN_URL || 'https://www.kbitai.com.cn',
  },
  pointsRate: parseInt(process.env.POINTS_RATE || '100'),
};

function validateConfig() {
  const warnings = [];
  if (!paymentConfig.wechat.appId) warnings.push('WECHAT_APP_ID 未配置，微信支付不可用');
  if (!paymentConfig.wechat.mchId) warnings.push('WECHAT_MCH_ID 未配置，微信支付不可用');
  if (!paymentConfig.alipay.appId) warnings.push('ALIPAY_APP_ID 未配置，支付宝不可用');
  if (!paymentConfig.alipay.privateKey) warnings.push('ALIPAY_PRIVATE_KEY 未配置，支付宝不可用');

  if (warnings.length > 0) {
    console.log('[Payment] 支付配置警告:');
    warnings.forEach(w => console.log(`  - ${w}`));
  } else {
    console.log('[Payment] 支付配置校验通过 ✅');
  }
  return warnings;
}

validateConfig();

module.exports = paymentConfig;
