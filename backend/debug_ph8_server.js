
const express = require('express');
const router = express.Router();

const ph8Log = {
  error: (msg, data) =&gt; console.error(`❌ [PH8] ${msg}`, data || ''),
  info: (msg, data) =&gt; console.log(`ℹ️  [PH8] ${msg}`, data || ''),
  debug: (msg, data) =&gt; console.log(`🔍 [PH8] ${msg}`, data || '')
};

console.log('='.repeat(80));
console.log('🔍 PH8 调试脚本 - 检查服务器上的实际代码');
console.log('='.repeat(80));

console.log('\n📁 当前目录内容:');
console.log('  ' + __dirname);

const fs = require('fs');
const path = require('path');

const ph8Path = path.join(__dirname, 'routes', 'ph8.js');

console.log('\n📄 ph8.js 文件路径:', ph8Path);
console.log('   文件存在:', fs.existsSync(ph8Path));

if (fs.existsSync(ph8Path)) {
  const content = fs.readFileSync(ph8Path, 'utf-8');
  console.log('\n📝 文件大小:', (content.length / 1024).toFixed(2), 'KB');
  
  console.log('\n🔍 检查关键函数:');
  
  const hasExtractUsage = content.includes('function extractUsage');
  console.log('   - extractUsage 函数:', hasExtractUsage ? '✅ 存在' : '❌ 不存在');
  
  const returnsObject = content.includes('return {') &amp;&amp; content.includes('cost:');
  console.log('   - 返回对象:', returnsObject ? '✅ 是' : '❌ 否');
  
  const hasNullReturn = content.includes('return null');
  console.log('   - 返回 null:', hasNullReturn ? '⚠️  是' : '✅ 否');
  
  const hasBinaryHandling = content.includes('二进制响应');
  console.log('   - 二进制响应处理:', hasBinaryHandling ? '✅ 是' : '❌ 否');
  
  console.log('\n📝 文件开头内容 (前 200 字符):');
  console.log('  ' + content.substring(0, 200).replace(/\n/g, '\n  '));
  
  if (hasNullReturn) {
    console.log('\n❌ 警告: 发现 return null！需要修复！');
  } else {
    console.log('\n✅ 文件看起来是修复后的版本！');
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('📋 操作建议:');
  console.log('='.repeat(80));
  console.log('1. 如果文件是旧版本，请重新上传修复后的 ph8.js');
  console.log('2. 上传后执行: pm2 restart kbitai-api');
  console.log('3. 检查日志: pm2 logs kbitai-api --lines 100');
  console.log('4. 测试聊天功能，查看是否正确记录费用');
  console.log('='.repeat(80));
} else {
  console.log('\n❌ 文件不存在！');
}
