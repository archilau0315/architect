
console.log('='.repeat(80));
console.log('🔍 检查 PH8 API 响应格式');
console.log('='.repeat(80));

var fs = require('fs');
var path = require('path');

var ph8Path = path.join(__dirname, 'routes', 'ph8.js');

if (fs.existsSync(ph8Path)) {
  var content = fs.readFileSync(ph8Path, 'utf-8');
  
  console.log('\n🔍 查找关键日志位置:');
  
  var extractUsageLine = -1;
  var lines = content.split('\n');
  
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].indexOf('extractUsage') !== -1) {
      extractUsageLine = i;
      console.log('  找到 extractUsage 在第', (i + 1, '行');
      break;
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('📋 现在请执行:');
  console.log('1. pm2 restart kbitai-api');
  console.log('2. pm2 logs kbitai-api');
  console.log('3. 发送一条聊天消息');
  console.log('4. 把日志输出发给我！');
  console.log('='.repeat(80));
} else {
  console.log('❌ 文件不存在');
}
