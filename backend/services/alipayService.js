const AlipaySdk = require('alipay-sdk');
const paymentConfig = require('../config/paymentConfig');

let alipaySdk = null;

function getAlipaySdk() {
  if (alipaySdk) return alipaySdk;

  const { appId, privateKey, alipayPublicKey } = paymentConfig.alipay;
  if (!appId || !privateKey) {
    console.warn('[Alipay] 配置不完整，支付宝不可用');
    return null;
  }

  try {
    alipaySdk = new AlipaySdk({
      appId,
      privateKey,
      alipayPublicKey: alipayPublicKey || undefined,
      signType: 'RSA2',
      charset: 'utf-8',
    });
    return alipaySdk;
  } catch (err) {
    console.error('[Alipay] 初始化失败:', err.message);
    return null;
  }
}

async function createPrecreateOrder(orderNo, amountCny, subject) {
  const sdk = getAlipaySdk();
  if (!sdk) {
    return { success: false, error: '支付宝未配置' };
  }

  try {
    const result = await sdk.exec('alipay.trade.precreate', {
      notifyUrl: paymentConfig.alipay.notifyUrl,
      bizContent: {
        out_trade_no: orderNo,
        total_amount: amountCny.toFixed(2),
        subject: subject || 'KBIT积分充值',
      },
    });

    if (result.qrCode || result.qr_code) {
      return { success: true, codeUrl: result.qrCode || result.qr_code };
    }

    if (result.code === '10000') {
      return { success: true, codeUrl: result.qrCode || result.qr_code };
    }

    return { success: false, error: result.subMsg || result.sub_msg || '创建支付宝订单失败' };
  } catch (err) {
    console.error('[Alipay] 创建订单失败:', err.message);
    return { success: false, error: '支付宝创建订单失败' };
  }
}

function verifyCallback(params) {
  const sdk = getAlipaySdk();
  if (!sdk) return false;

  try {
    const sign = params.sign;
    const signType = params.sign_type;
    const checkParams = { ...params };
    delete checkParams.sign;
    delete checkParams.sign_type;

    const sorted = Object.keys(checkParams)
      .filter(key => checkParams[key] !== '' && checkParams[key] !== undefined)
      .sort()
      .map(key => `${key}=${checkParams[key]}`)
      .join('&');

    const verify = sdk.checkNotifySign(sorted, sign, signType);
    return verify;
  } catch (err) {
    console.error('[Alipay] 验签失败:', err.message);
    return false;
  }
}

module.exports = {
  createPrecreateOrder,
  verifyCallback,
  isAvailable: () => !!(paymentConfig.alipay.appId && paymentConfig.alipay.privateKey),
};
