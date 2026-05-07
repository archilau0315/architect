
console.log('='.repeat(80));
console.log('🔍 检查服务器上的 ph8.js 文件');
console.log('='.repeat(80));

var fs = require('fs');
var path = require('path');

var ph8Path = path.join(__dirname, 'routes', 'ph8.js');

console.log('\n📄 文件路径:', ph8Path);
console.log('   文件存在:', fs.existsSync(ph8Path));

if (fs.existsSync(ph8Path)) {
  var content = fs.readFileSync(ph8Path, 'utf-8');
  console.log('\n📝 文件大小:', (content.length / 1024).toFixed(2), 'KB');
  
  console.log('\n🔍 检查关键内容:');
  
  var hasExtractUsage = content.indexOf('function extractUsage') !== -1;
  console.log('   - extractUsage 函数:', hasExtractUsage ? '✅ 存在' : '❌ 不存在');
  
  var hasNullReturn = content.indexOf('return null') !== -1;
  console.log('   - 返回 null:', hasNullReturn ? '⚠️  是' : '✅ 否');
  
  var hasBinaryFix = content.indexOf('二进制响应') !== -1;
  console.log('   - 二进制修复:', hasBinaryFix ? '✅ 是' : '❌ 否');
  
  console.log('\n📝 文件开头 (前 300 字符):');
  console.log('  ' + content.substring(0, 300).replace(/\n/g, '\n  '));
  
  if (hasNullReturn) {
    console.log('\n❌ 警告: 文件还是旧版本！需要上传修复后的 ph8.js！');
  } else {
    console.log('\n✅ 文件是修复后的版本！');
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('📋 操作步骤:');
  console.log('='.repeat(80));
  if (hasNullReturn) {
    console.log('1. 上传修复后的 ph8.js 到 /www/wwwroot/api.kbitai.com.cn/routes/');
    console.log('2. 执行: pm2 restart kbitai-api');
  } else {
    console.log('1. 文件已更新，执行: pm2 restart kbitai-api');
  }
  console.log('3. 查看日志: pm2 logs kbitai-api --lines 50');
  console.log('4. 测试聊天功能，验证费用记录');
  console.log('='.repeat(80));
} else {
  console.log('\n❌ 文件不存在！');
}
