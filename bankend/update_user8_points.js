/**
 * 直接更新 ID 8 用户积分的脚本
 * 将 ID 8 用户的消耗积分更正为正确值
 */

require('dotenv').config();
const db = require('./db');

async function updateUser8Points() {
  try {
    console.log('=== 开始更新 ID 8 用户积分 ===');
    
    // 正确的积分值：19350（万分之一元） ÷ 100 = 193.5 → 194 积分
    const correctPoints = 194;
    
    // 直接更新 ID 8 用户的积分
    const [result] = await db.query(
      `UPDATE kbit_users
       SET total_consumed_points = ?
       WHERE id = 8`,
      [correctPoints]
    );
    
    console.log(`更新 ID 8 用户积分：${correctPoints}`);
    console.log(`影响行数：${result.affectedRows}`);
    
    // 验证更新结果
    const [user8Info] = await db.query(
      `SELECT total_consumed_points
       FROM kbit_users
       WHERE id = 8`
    );
    
    if (user8Info.length > 0) {
      console.log(`更新后积分：${user8Info[0].total_consumed_points}`);
      // 转换为数字进行比较，处理小数格式
      const actualPoints = parseFloat(user8Info[0].total_consumed_points);
      if (actualPoints === correctPoints) {
        console.log('✅ ID 8 用户积分更新成功！');
      } else {
        console.log('❌ ID 8 用户积分更新失败！');
      }
    }
    
  } catch (error) {
    console.error('更新过程中出错:', error);
  } finally {
    db.end();
  }
}

updateUser8Points();
