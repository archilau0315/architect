const express = require('express');
const router = express.Router();
const db = require('../db');
const ph8TokenService = require('../services/ph8TokenService');
const wechatPayService = require('../services/wechatPayService');
const alipayService = require('../services/alipayService');
const paymentConfig = require('../config/paymentConfig');
const QRCode = require('qrcode');

function generateOrderNo() {
  const now = new Date();
  const ts = now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `KB${ts}${rand}`;
}

async function creditPointsAndCompleteOrder(order) {
  const rechargeResult = await ph8TokenService.rechargeBalance(order.user_id, order.points);
  if (rechargeResult) {
    await db.query(
      `UPDATE kbit_payment_orders SET status = 'verified', verified_at = NOW(), admin_note = '支付回调自动确认' WHERE id = ?`,
      [order.id]
    );
    console.log(`[Payment] 订单 ${order.order_no} 支付成功，${order.points} 积分已到账`);
    return true;
  } else {
    await db.query(
      `UPDATE kbit_payment_orders SET admin_note = '[警告] 支付成功但积分充值失败，需手动处理' WHERE id = ?`,
      [order.id]
    );
    console.error(`[Payment] 订单 ${order.order_no} 积分充值失败`);
    return false;
  }
}

router.post('/create-order', async (req, res) => {
  try {
    const { userId, userEmail, type, amountCny, points, tierCode, billingCycle, paymentMethod, userNote } = req.body;

    if (!userId || !amountCny || !points) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }

    if (amountCny <= 0 || points <= 0) {
      return res.status(400).json({ success: false, error: '金额和积分必须大于0' });
    }

    if (amountCny > 10000) {
      return res.status(400).json({ success: false, error: '单次充值金额不能超过10000元' });
    }

    const [recent] = await db.query(
      `SELECT COUNT(*) AS cnt FROM kbit_payment_orders WHERE user_id = ? AND status = 'pending' AND created_at > DATE_SUB(NOW(), INTERVAL 10 MINUTE)`,
      [userId]
    );
    if (recent[0].cnt >= 5) {
      return res.status(429).json({ success: false, error: '操作过于频繁，请稍后再试' });
    }

    const orderNo = generateOrderNo();
    const description = type === 'topup'
      ? `KBIT积分充值 ${points}积分`
      : `KBIT订阅 ${tierCode || ''} ${billingCycle || ''}`;

    let qrCodeUrl = null;
    let simulatedMode = false;

    const wechatAvailable = wechatPayService.isAvailable();
    const alipayAvailable = alipayService.isAvailable();

    if (paymentMethod === 'wechat' && wechatAvailable) {
      const wxResult = await wechatPayService.createNativeOrder(orderNo, amountCny, description);
      if (wxResult.success) {
        qrCodeUrl = wxResult.codeUrl;
      } else {
        return res.status(500).json({ success: false, error: wxResult.error });
      }
    } else if (paymentMethod === 'alipay' && alipayAvailable) {
      const aliResult = await alipayService.createPrecreateOrder(orderNo, amountCny, description);
      if (aliResult.success) {
        qrCodeUrl = aliResult.codeUrl;
      } else {
        return res.status(500).json({ success: false, error: aliResult.error });
      }
    } else {
      simulatedMode = true;
    }

    let qrCodeBase64 = null;
    if (qrCodeUrl) {
      try {
        qrCodeBase64 = await QRCode.toDataURL(qrCodeUrl, {
          width: 256,
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' },
        });
      } catch (qrErr) {
        console.error('[Payment] 生成二维码失败:', qrErr.message);
        qrCodeBase64 = null;
      }
    }

    const [result] = await db.query(
      `INSERT INTO kbit_payment_orders (order_no, user_id, user_email, type, amount_cny, points, tier_code, billing_cycle, payment_method, status, user_note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [orderNo, userId, userEmail || null, type || 'topup', amountCny, points, tierCode || null, billingCycle || null, paymentMethod || null, userNote || null]
    );

    res.json({
      success: true,
      data: {
        orderId: result.insertId,
        orderNo,
        amountCny,
        points,
        paymentMethod,
        qrCode: qrCodeBase64,
        codeUrl: qrCodeUrl,
        simulatedMode,
        status: 'pending',
        createdAt: new Date().toISOString(),
      }
    });
  } catch (err) {
    console.error('[Payment] 创建订单失败:', err.message);
    res.status(500).json({ success: false, error: '创建订单失败' });
  }
});

router.post('/wechat-notify', express.raw({ type: '*/*' }), async (req, res) => {
  try {
    const body = req.body.toString('utf8');
    const headers = req.headers;

    const verifyResult = wechatPayService.verifyCallback(headers, body);
    if (!verifyResult.verified) {
      console.error('[Payment] 微信回调验签失败');
      return res.status(400).send('FAIL');
    }

    const data = JSON.parse(body);
    let tradeResult;

    if (data.resource) {
      tradeResult = wechatPayService.decryptResource(data.resource);
    } else {
      tradeResult = data;
    }

    if (!tradeResult) {
      console.error('[Payment] 微信回调解密失败');
      return res.status(400).send('FAIL');
    }

    const orderNo = tradeResult.out_trade_no;
    const tradeState = tradeResult.trade_state;

    if (tradeState === 'SUCCESS') {
      const [orders] = await db.query(
        `SELECT * FROM kbit_payment_orders WHERE order_no = ? AND status = 'pending'`,
        [orderNo]
      );

      if (orders.length === 0) {
        console.warn(`[Payment] 微信回调: 订单 ${orderNo} 不存在或已处理`);
        return res.json({ code: 'SUCCESS', message: '已处理' });
      }

      await creditPointsAndCompleteOrder(orders[0]);
    }

    res.json({ code: 'SUCCESS', message: 'OK' });
  } catch (err) {
    console.error('[Payment] 微信回调处理失败:', err.message);
    res.status(500).send('FAIL');
  }
});

router.post('/alipay-notify', express.urlencoded({ extended: false }), async (req, res) => {
  try {
    const params = req.body;

    const verified = alipayService.verifyCallback(params);
    if (!verified) {
      console.error('[Payment] 支付宝回调验签失败');
      return res.send('fail');
    }

    const tradeStatus = params.trade_status;
    const orderNo = params.out_trade_no;

    if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') {
      const [orders] = await db.query(
        `SELECT * FROM kbit_payment_orders WHERE order_no = ? AND status = 'pending'`,
        [orderNo]
      );

      if (orders.length === 0) {
        console.warn(`[Payment] 支付宝回调: 订单 ${orderNo} 不存在或已处理`);
        return res.send('success');
      }

      const order = orders[0];
      const paidAmount = parseFloat(params.total_amount);
      if (Math.abs(paidAmount - parseFloat(order.amount_cny)) > 0.01) {
        console.error(`[Payment] 金额不匹配: 订单 ${order.amount_cny}元, 实付 ${paidAmount}元`);
        return res.send('fail');
      }

      await creditPointsAndCompleteOrder(order);
    }

    res.send('success');
  } catch (err) {
    console.error('[Payment] 支付宝回调处理失败:', err.message);
    res.send('fail');
  }
});

router.get('/order-status/:orderNo', async (req, res) => {
  try {
    const { orderNo } = req.params;

    const [orders] = await db.query(
      `SELECT order_no, status, points, amount_cny, payment_method FROM kbit_payment_orders WHERE order_no = ?`,
      [orderNo]
    );

    if (orders.length === 0) {
      return res.status(404).json({ success: false, error: '订单不存在' });
    }

    const order = orders[0];
    res.json({
      success: true,
      data: {
        orderNo: order.order_no,
        status: order.status,
        points: order.points,
        amountCny: parseFloat(order.amount_cny),
        paymentMethod: order.payment_method,
      }
    });
  } catch (err) {
    console.error('[Payment] 查询订单状态失败:', err.message);
    res.status(500).json({ success: false, error: '查询失败' });
  }
});

router.get('/my-orders', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || req.query.userId;
    if (!userId) {
      return res.status(400).json({ success: false, error: '缺少用户ID' });
    }

    const [orders] = await db.query(
      `SELECT order_no, type, amount_cny, points, tier_code, billing_cycle, payment_method, status, user_note, admin_note, created_at, verified_at FROM kbit_payment_orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
      [userId]
    );

    res.json({ success: true, data: orders });
  } catch (err) {
    console.error('[Payment] 查询订单失败:', err.message);
    res.status(500).json({ success: false, error: '查询订单失败' });
  }
});

router.get('/pending-count', async (req, res) => {
  try {
    const [result] = await db.query(
      `SELECT COUNT(*) AS count FROM kbit_payment_orders WHERE status = 'pending'`
    );
    res.json({ success: true, data: { count: result[0].count } });
  } catch (err) {
    console.error('[Payment] 查询待审核数量失败:', err.message);
    res.status(500).json({ success: false, error: '查询失败' });
  }
});

module.exports = router;
