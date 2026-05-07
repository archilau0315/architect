
console.log('='.repeat(80));
console.log('🧪 简单测试 - 验证费用提取逻辑');
console.log('='.repeat(80));

function extractUsage(responseBody) {
  try {
    if (typeof responseBody === 'string') {
      responseBody = JSON.parse(responseBody);
    }

    var promptTokens = 0;
    var completionTokens = 0;
    var totalTokens = 0;
    var cachedTokens = 0;
    var cost = 0;
    
    console.log('\n🔍 分析响应:');
    
    if (responseBody.usage) {
      promptTokens = responseBody.usage.prompt_tokens || responseBody.usage.promptTokens || 0;
      completionTokens = responseBody.usage.completion_tokens || responseBody.usage.completionTokens || 0;
      totalTokens = responseBody.usage.total_tokens || responseBody.usage.totalTokens || 0;
      cachedTokens = responseBody.usage.cached_tokens || responseBody.usage.cachedTokens || 0;
      cost = responseBody.usage.cost || responseBody.usage.price || responseBody.usage.charge || 0;
      console.log('  ✓ 从 usage 提取 cost:', cost);
    }
    
    if (!cost) {
      cost = responseBody.cost || responseBody.price || responseBody.charge || 
             responseBody.total_cost || responseBody.totalPrice || 0;
      if (cost) console.log('  ✓ 从根级字段提取 cost:', cost);
    }

    if (!cost && responseBody.output && responseBody.output.usage) {
      cost = responseBody.output.usage.cost || responseBody.output.usage.price || 0;
      if (cost) console.log('  ✓ 从 output.usage 提取 cost:', cost);
    }

    if (!cost && responseBody.results && Array.isArray(responseBody.results)) {
      for (var i = 0; i < responseBody.results.length; i++) {
        var result = responseBody.results[i];
        if (result.usage) {
          cost = cost || result.usage.cost || result.usage.price || 0;
        }
        cost = cost || result.cost || result.price || 0;
      }
      if (cost) console.log('  ✓ 从 results 提取 cost:', cost);
    }

    var result = {
      promptTokens: parseInt(promptTokens) || 0,
      completionTokens: parseInt(completionTokens) || 0,
      totalTokens: parseInt(totalTokens) || 0,
      cachedTokens: parseInt(cachedTokens) || 0,
      cost: typeof cost === 'string' ? parseFloat(cost) : (cost || 0)
    };

    return result;
  } catch (err) {
    console.log('❌ 提取失败:', err.message);
    return { promptTokens: 0, completionTokens: 0, totalTokens: 0, cachedTokens: 0, cost: 0 };
  }
}

var testCases = [
  {
    name: '有 usage.cost',
    response: { usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15, cost: 0.0015 } }
  },
  {
    name: '有 usage.price',
    response: { usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30, price: 0.0020 } }
  },
  {
    name: '根级 cost',
    response: { usage: { total_tokens: 25 }, cost: 0.0025 }
  },
  {
    name: '没有费用数据',
    response: { usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 } }
  }
];

testCases.forEach(function(test) {
  console.log('\n' + '='.repeat(80));
  console.log('📋 ' + test.name);
  console.log('='.repeat(80));
  
  var result = extractUsage(test.response);
  
  console.log('\n📊 结果:');
  console.log('  费用:', result.cost);
  console.log('  Token:', result.totalTokens);
  
  if (result.cost > 0) {
    console.log('  ✅ 成功！', (result.cost * 1000).toFixed(0) + ' 积分');
  } else {
    console.log('  ⚠️  没有找到费用数据');
  }
});

console.log('\n' + '='.repeat(80));
console.log('✅ 测试完成！');
console.log('='.repeat(80));
