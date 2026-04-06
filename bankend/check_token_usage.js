/**
 * 检查 token_usage 表中的数据
 */

const db = require('./db');

async function checkTokenUsage() {
  try {
    console.log('=== 检查 token_usage 表数据 ===');
    
    // 查询最近的 10 条记录
    const [rows] = await db.query(
      'SELECT id, user_id, model, request_type, total_tokens, created_at FROM token_usage ORDER BY created_at DESC LIMIT 10'
    );
    
    console.log('最近 10 条记录:');
    rows.forEach(row => {
      console.log(`ID: ${row.id}, 用户: ${row.user_id}, 模型: ${row.model}, 类型: ${row.request_type}, total_tokens: ${row.total_tokens}, 时间: ${row.created_at}`);
    });
    
    // 统计平均 total_tokens
    const [avgResult] = await db.query(
      'SELECT AVG(total_tokens) as avg_tokens FROM token_usage WHERE total_tokens > 0'
    );
    
    console.log(`\n平均 total_tokens: ${avgResult[0].avg_tokens}`);
    
  } catch (err) {
    console.error('检查 token_usage 表失败:', err);
  } finally {
    db.end();
  }
}

checkTokenUsage();