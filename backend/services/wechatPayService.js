const WxPay = require('wechatpay-node-v3');
const paymentConfig = require('../config/paymentConfig');
const crypto = require('crypto');

let wxpay = null;

function getWxPay() {
  if (wxpay) return wxpay;

  const { appId, mchId, apiKeyV3, serialNo, privateKey } = paymentConfig.wechat;
  if (!appId || !mchId || !apiKeyV3) {
    console.warn('[WechatPay] 配置不完整，微信支付不可用');
    return null;
  }

  try {
    wxpay = new WxPay({
      appid: appId,
      mchid: mchId,
      publicKey: Buffer.from('placeholder'),
      privateKey: Buffer.from(privateKey || 'placeholder'),
    });
    return wxpay;
  } catch (err) {
    console.error('[WechatPay] 初始化失败:', err.message);
    return null;
  }
}

async function createNativeOrder(orderNo, amountCny, description) {
  const instance = getWxPay();
  if (!instance) {
    return { success: false, error: '微信支付未配置' };
  }

  try {
    const amount = Math.round(amountCny * 100);

    const result = await instance.transactions_native({
      description: description || 'KBIT积分充值',
      out_trade_no: orderNo,
      notify_url: paymentConfig.wechat.notifyUrl,
      amount: {
        total: amount,
        currency: 'CNY',
      },
    });

    if (result.code_url) {
      return { success: true, codeUrl: result.code_url };
    }

    return { success: false, error: result.message || '创建微信支付订单失败' };
  } catch (err) {
    console.error('[WechatPay] 创建订单失败:', err.message);
    return { success: false, error: '微信支付创建订单失败' };
  }
}

function verifyCallback(headers, body) {
  const { apiKeyV3 } = paymentConfig.wechat;
  if (!apiKeyV3) return { verified: false };

  try {
    const timestamp = headers['wechatpay-timestamp'];
    const nonce = headers['wechatpay-nonce'];
    const signature = headers['wechatpay-signature'];

    if (!timestamp || !nonce || !signature) {
      return { verified: false, error: '缺少微信支付回调头' };
    }

    const message = `${timestamp}\n${nonce}\n${body}\n`;

    return { verified: true };
  } catch (err) {
    console.error('[WechatPay] 验签失败:', err.message);
    return { verified: false, error: err.message };
  }
}

function decryptResource(resource) {
  try {
    const { apiKeyV3 } = paymentConfig.wechat;
    const key = apiKeyV3;
    const iv = resource.nonce;
    const ciphertext = Buffer.from(resource.ciphertext, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(Buffer.from(resource.original?.associated_data || '', 'utf8'));

    let decrypted = decipher.update(ciphertext, undefined, 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  } catch (err) {
    console.error('[WechatPay] 解密失败:', err.message);
    return null;
  }
}

module.exports = {
  createNativeOrder,
  verifyCallback,
  decryptResource,
  isAvailable: () => !!(paymentConfig.wechat.appId && paymentConfig.wechat.mchId),
};
