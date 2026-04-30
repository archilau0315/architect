const bcrypt = require('bcrypt');
const db = require('./db');

async function createAdmin() {
  const username = 'admin';
  const password = '100422lyf';
  const role = 'super';

  console.log(`正在创建管理员账号...`);
  console.log(`用户名: ${username}`);
  console.log(`密码: ${password}`);
  console.log(`角色: ${role}`);

  try {
    // 生成密码哈希
    const passwordHash = await bcrypt.hash(password, 10);
    console.log(`密码哈希: ${passwordHash}`);

    // 检查管理员是否已存在
    const [existing] = await db.query('SELECT * FROM admins WHERE username = ?', [username]);
    
    if (existing.length > 0) {
      console.log(`管理员 ${username} 已存在，正在更新密码...`);
      await db.query('UPDATE admins SET password_hash = ?, role = ?, updated_at = NOW() WHERE username = ?', [passwordHash, role, username]);
      console.log(`✅ 管理员密码已更新！`);
    } else {
      console.log(`正在创建新管理员...`);
      await db.query('INSERT INTO admins (username, password_hash, role) VALUES (?, ?, ?)', [username, passwordHash, role]);
      console.log(`✅ 管理员创建成功！`);
    }

    console.log('\n您现在可以使用以下账号登录：');
    console.log(`用户名: ${username}`);
    console.log(`密码: ${password}`);
    
  } catch (error) {
    console.error('❌ 创建管理员失败:', error);
  }
  
  process.exit(0);
}

createAdmin();
