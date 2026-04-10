/**
 * 积分计算修复脚本
 * 用于重新计算所有用户的积分消耗
 * 修正 PH8 API 费用到积分的转换逻辑
 */

require('dotenv').config();
const db = require('./db');

async function fixPointsCalculation() {
  try {
    console.log('=== 开始积分计算修复 ===\n');
    
    // 1. 获取所有用户的 token_usage 数据
    console.log('1. 统计每个用户的费用消耗...');
    const userStats = await db.query(
      `SELECT user_id, SUM(total_tokens) as total_cost
       FROM token_usage
       GROUP BY user_id
       HAVING total_cost > 0`
    );
    
    console.log(`   发现 ${userStats.length} 个有费用消耗的用户`);
    console.log('   原始统计数据:', JSON.stringify(userStats));
    
    // 过滤无效数据
    const validUserStats = userStats.filter(user => {
      return user.user_id !== undefined && user.user_id !== null && user.total_cost > 0;
    });
    
    console.log(`   有效用户数: ${validUserStats.length}\n`);
    
    // 2. 重新计算每个用户的积分消耗
    console.log('2. 重新计算积分消耗...');
    const COST_TO_POINTS_RATIO = 100; // 1 积分 = 100 万分之一元
    
    for (const user of validUserStats) {
      const { user_id, total_cost } = user;
      
      console.log(`   处理用户: user_id=${user_id}, total_cost=${total_cost}`);
      
      const calculatedPoints = Math.ceil(total_cost / COST_TO_POINTS_RATIO);
      
      // 更新 kbit_users 表中的累计消耗积分
      try {
        const result = await db.query(
          `UPDATE kbit_users
           SET total_consumed_points = ?
           WHERE email = ? OR id = ?`,
          [calculatedPoints, user_id, user_id]
        );
        console.log(`   用户 ${user_id}: 费用=${total_cost}（万分之一元） → 积分=${calculatedPoints}，影响行数: ${result.affectedRows}`);
      } catch (err) {
        console.error(`   更新用户 ${user_id} 失败:`, err.message);
      }
    }
    
    // 3. 检查 ID 8 用户的修复情况
    console.log('\n3. 检查 ID 8 用户的修复情况...');
    const user8Stats = await db.query(
      `SELECT SUM(total_tokens) as total_cost
       FROM token_usage
       WHERE user_id = '8'`
    );
    
    if (user8Stats.length > 0 && user8Stats[0].total_cost) {
      const totalCost = user8Stats[0].total_cost;
      const calculatedPoints = Math.ceil(totalCost / COST_TO_POINTS_RATIO);
      
      console.log(`   ID 8 用户: 总费用=${totalCost}（万分之一元） → 计算积分=${calculatedPoints}`);
      
      // 验证数据库中的值
      const user8Info = await db.query(
        `SELECT total_consumed_points
         FROM kbit_users
         WHERE id = 8`
      );
      
      if (user8Info.length > 0) {
        console.log(`   数据库中积分: ${user8Info[0].total_consumed_points}`);
        if (user8Info[0].total_consumed_points === calculatedPoints) {
          console.log('   ✅ ID 8 用户积分修复成功!');
        } else {
          console.log('   ❌ ID 8 用户积分修复失败!');
        }
      }
    } else {
      console.log('   ⚠️  未找到 ID 8 用户的费用记录');
    }
    
    console.log('\n=== 积分计算修复完成 ===');
    console.log('所有用户的积分消耗已重新计算');
    console.log('费用到积分的转换逻辑：1 积分 = 0.01 元（100 积分 = 1 元）');
    console.log('计算方式：积分 = 费用（万分之一元） ÷ 100，向上取整');
    
  } catch (error) {
    console.error('修复过程中出错:', error);
  } finally {
    // 关闭数据库连接
    db.end();
  }
}

// 执行修复
fixPointsCalculation();
