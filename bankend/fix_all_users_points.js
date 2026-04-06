/**
 * 批量积分修复脚本
 * 处理所有用户的积分计算
 * 正确处理 token_usage 表中的字符串 user_id
 */

require('dotenv').config();
const db = require('./db');

async function fixAllUsersPoints() {
  try {
    console.log('=== 开始批量积分修复 ===\n');
    
    const COST_TO_POINTS_RATIO = 100; // 1 积分 = 100 万分之一元
    
    // 1. 获取所有用户
    console.log('1. 获取所有用户...');
    const [users] = await db.query(
      `SELECT id, email, nickname, total_consumed_points
       FROM kbit_users
       ORDER BY id`
    );
    
    console.log(`   发现 ${users.length} 个用户\n`);
    
    // 2. 处理每个用户
    console.log('2. 处理每个用户的积分...');
    let fixedCount = 0;
    
    for (const user of users) {
      const { id, email, nickname, total_consumed_points } = user;
      
      console.log(`   处理用户: ID=${id}, 邮箱=${email}, 昵称=${nickname}`);
      console.log(`   当前消耗积分: ${total_consumed_points}`);
      
      // 3. 查找该用户在 token_usage 表中的费用记录
      // 尝试多种 user_id 格式
      const userIdentifiers = [
        id.toString(),      // 数字 ID
        email,              // 邮箱
        nickname            // 昵称
      ];
      
      let totalCost = 0;
      
      for (const identifier of userIdentifiers) {
        const [usage] = await db.query(
          `SELECT SUM(total_tokens) as total_cost
           FROM token_usage
           WHERE user_id = ?`,
          [identifier]
        );
        
        if (usage[0].total_cost) {
          totalCost = usage[0].total_cost;
          console.log(`   找到费用记录: ${totalCost}（万分之一元）`);
          break;
        }
      }
      
      if (totalCost > 0) {
        // 计算正确的积分
        const calculatedPoints = Math.ceil(totalCost / COST_TO_POINTS_RATIO);
        console.log(`   计算积分: ${calculatedPoints}`);
        
        // 更新积分
        const [result] = await db.query(
          `UPDATE kbit_users
           SET total_consumed_points = ?
           WHERE id = ?`,
          [calculatedPoints, id]
        );
        
        if (result.affectedRows > 0) {
          console.log(`   ✅ 积分更新成功: ${calculatedPoints}`);
          fixedCount++;
        } else {
          console.log(`   ❌ 积分更新失败`);
        }
      } else {
        console.log(`   ⚠️  未找到费用记录，跳过`);
      }
      
      console.log('');
    }
    
    console.log('=== 批量积分修复完成 ===');
    console.log(`处理用户数: ${users.length}`);
    console.log(`修复用户数: ${fixedCount}`);
    console.log('费用到积分的转换逻辑：1 积分 = 0.01 元（100 积分 = 1 元）');
    console.log('计算方式：积分 = 费用（万分之一元） ÷ 100，向上取整');
    
  } catch (error) {
    console.error('修复过程中出错:', error);
  } finally {
    db.end();
  }
}

fixAllUsersPoints();
