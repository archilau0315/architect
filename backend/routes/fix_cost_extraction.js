const fs = require('fs');
const path = require('path');

// 读取文件
const filePath = path.join(__dirname, 'ph8.js');
let content = fs.readFileSync(filePath, 'utf-8');

// 修复图像生成的费用提取逻辑
const oldCode = `      // 尝试从PH8响应中提取真实费用（图像生成）
      let ph8ActualCost2 = 0;
      try {
        if (!isBinaryContent && typeof data === 'string' && data.trim()) {
          const respBody = JSON.parse(data);
          ph8ActualCost2 = respBody.usage?.cost 
                       || respBody.usage?.price 
                       || respBody.cost || respBody.price || respBody.charge
                       || respBody.usage?.total_cost || 0;
        }
      } catch(e) {}`;

const newCode = `      // 尝试从PH8响应中提取真实费用（图像生成）
      let ph8ActualCost2 = 0;
      try {
        // 首先尝试从响应头中提取费用（PH8会在响应头中返回费用）
        const costHeader = proxyRes.headers['x-ph8-cost'] || 
                           proxyRes.headers['x-cost'] || 
                           proxyRes.headers['x-api-cost'] ||
                           proxyRes.headers['cost'];
        if (costHeader) {
          ph8ActualCost2 = parseFloat(costHeader);
          console.log(\`[PH8 Image v1] 从响应头获取费用: \${ph8ActualCost2}元\`);
        }
        
        // 如果响应头没有，尝试从JSON响应体中提取
        if (!ph8ActualCost2 && !isBinaryContent && typeof data === 'string' && data.trim()) {
          const respBody = JSON.parse(data);
          ph8ActualCost2 = respBody.usage?.cost 
                       || respBody.usage?.price 
                       || respBody.cost || respBody.price || respBody.charge
                       || respBody.usage?.total_cost || 0;
          console.log(\`[PH8 Image v1] 从响应体获取费用: \${ph8ActualCost2}元\`);
        }
        
        // 如果还是没有，尝试从请求头中的预估费用
        if (!ph8ActualCost2) {
          const estimatedCost = req.headers['x-estimated-cost'];
          if (estimatedCost) {
            ph8ActualCost2 = parseFloat(estimatedCost);
            console.log(\`[PH8 Image v1] 从请求头获取预估费用: \${ph8ActualCost2}元\`);
          }
        }
      } catch(e) {
        console.log(\`[PH8 Image v1] 提取费用失败: \${e.message}\`);
      }`;

// 替换代码
if (content.includes(oldCode)) {
  content = content.replace(oldCode, newCode);
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log('✅ 图像生成费用提取逻辑已修复');
} else {
  console.log('❌ 未找到需要修复的代码段');
}

// 检查视频生成的费用提取逻辑
const videoOldCode = `      let calculatedCost = 0;
      if (responseBody) {
        // 尝试从多种格式获取费用信息
        const usage = responseBody.usage || responseBody;
        const costFromResponse = usage.cost || usage.price || usage.charge || responseBody.cost || responseBody.price || responseBody.charge;
        
        if (costFromResponse !== undefined && costFromResponse !== null) {
          calculatedCost = typeof costFromResponse === 'number' ? costFromResponse : parseFloat(costFromResponse);
        } else if (responseBody.total_tokens || responseBody.tokens || usage.total_tokens) {
          // 如果没有直接的费用，用token数计算
          const totalTokens = responseBody.total_tokens || responseBody.tokens || usage.total_tokens || 0;
          calculatedCost = totalTokens * 0.0000042;
        }
      }`;

const videoNewCode = `      let calculatedCost = 0;
      let totalTokens = 0;
      if (responseBody) {
        // 尝试从响应头中提取费用
        const costHeader = proxyRes.headers['x-ph8-cost'] || 
                           proxyRes.headers['x-cost'] || 
                           proxyRes.headers['x-api-cost'];
        if (costHeader) {
          calculatedCost = parseFloat(costHeader);
          console.log(\`[PH8 Video] 从响应头获取费用: \${calculatedCost}元\`);
        }
        
        // 如果响应头没有，尝试从响应体获取
        if (!calculatedCost) {
          const usage = responseBody.usage || responseBody;
          const costFromResponse = usage.cost || usage.price || usage.charge || responseBody.cost || responseBody.price || responseBody.charge;
          
          if (costFromResponse !== undefined && costFromResponse !== null) {
            calculatedCost = typeof costFromResponse === 'number' ? costFromResponse : parseFloat(costFromResponse);
          } else if (responseBody.total_tokens || responseBody.tokens || usage.total_tokens) {
            // 如果没有直接的费用，用token数计算
            totalTokens = responseBody.total_tokens || responseBody.tokens || usage.total_tokens || 0;
            calculatedCost = totalTokens * 0.0000042;
          }
        }
      }`;

// 替换视频生成的代码
if (content.includes(videoOldCode)) {
  content = content.replace(videoOldCode, videoNewCode);
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log('✅ 视频生成费用提取逻辑已修复');
} else {
  console.log('⚠️ 视频生成代码段可能已更新，跳过');
}

console.log('修复完成！');
