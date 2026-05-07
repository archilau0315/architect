
const ph8Log = {
  error: (msg, data) =&gt; console.error(`❌ [PH8] ${msg}`, data || ''),
  info: (msg, data) =&gt; console.log(`ℹ️  [PH8] ${msg}`, data || ''),
  debug: (msg, data) =&gt; console.log(`🔍 [PH8] ${msg}`, data || '')
};

function extractUsage(responseBody) {
  try {
    if (typeof responseBody === 'string') {
      responseBody = JSON.parse(responseBody);
    }

    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;
    let cachedTokens = 0;
    let cost = 0;
    
    console.log('\n🔍 开始分析响应体:');
    console.log('  ├─ responseBody:', JSON.stringify(responseBody, null, 2).substring(0, 500));
    console.log('  ├─ 有 usage 吗?', !!responseBody.usage);
    console.log('  ├─ usage.cost:', responseBody.usage?.cost);
    console.log('  ├─ usage.price:', responseBody.usage?.price);
    console.log('  ├─ 根级 cost:', responseBody.cost);
    console.log('  ├─ 根级 price:', responseBody.price);
    console.log('  ├─ 根级 charge:', responseBody.charge);
    console.log('  ├─ 根级 total_cost:', responseBody.total_cost);
    console.log('  ├─ 有 output 吗?', !!responseBody.output);
    console.log('  ├─ output.usage 吗?', !!responseBody.output?.usage);
    console.log('  └─ 有 results 吗?', !!responseBody.results);
    
    if (responseBody.usage) {
      promptTokens = responseBody.usage.prompt_tokens || responseBody.usage.promptTokens || 0;
      completionTokens = responseBody.usage.completion_tokens || responseBody.usage.completionTokens || 0;
      totalTokens = responseBody.usage.total_tokens || responseBody.usage.totalTokens || 0;
      cachedTokens = responseBody.usage.cached_tokens || responseBody.usage.cachedTokens || 0;
      cost = responseBody.usage.cost || responseBody.usage.price || responseBody.usage.charge || 0;
      console.log('  ✅ 从 responseBody.usage 提取:', { cost, totalTokens });
    }
    
    if (!totalTokens) {
      totalTokens = responseBody.total_tokens || responseBody.tokens || responseBody.totalTokens || 0;
    }
    if (!promptTokens) {
      promptTokens = responseBody.prompt_tokens || responseBody.promptTokens || 0;
    }
    if (!completionTokens) {
      completionTokens = responseBody.completion_tokens || responseBody.completionTokens || 0;
    }
    if (!cachedTokens) {
      cachedTokens = responseBody.cached_tokens || responseBody.cachedTokens || 0;
    }
    if (!cost) {
      cost = responseBody.cost || responseBody.price || responseBody.charge || 
             responseBody.total_cost || responseBody.totalPrice || 0;
      if (cost) console.log('  ✅ 从根级字段提取:', { cost });
    }

    if (!cost &amp;&amp; responseBody.output &amp;&amp; responseBody.output.usage) {
      cost = responseBody.output.usage.cost || responseBody.output.usage.price || 0;
      if (!totalTokens) {
        totalTokens = responseBody.output.usage.total_tokens || responseBody.output.usage.totalTokens || 0;
      }
      if (cost) console.log('  ✅ 从 responseBody.output.usage 提取:', { cost });
    }

    if (!cost &amp;&amp; responseBody.results &amp;&amp; Array.isArray(responseBody.results)) {
      for (const result of responseBody.results) {
        if (result.usage) {
          cost = cost || result.usage.cost || result.usage.price || 0;
          totalTokens = totalTokens || result.usage.total_tokens || result.usage.totalTokens || 0;
        }
        cost = cost || result.cost || result.price || 0;
      }
      if (cost) console.log('  ✅ 从 responseBody.results 提取:', { cost });
    }

    const result = {
      promptTokens: parseInt(promptTokens) || 0,
      completionTokens: parseInt(completionTokens) || 0,
      totalTokens: parseInt(totalTokens) || 0,
      cachedTokens: parseInt(cachedTokens) || 0,
      cost: typeof cost === 'string' ? parseFloat(cost) : (cost || 0)
    };

    console.log('\n📊 最终提取结果:');
    console.log('  ├─ 费用:', result.cost, '(类型:', typeof result.cost, ')');
    console.log('  ├─ Token:', result.totalTokens);
    console.log('  └─ 完整对象:', result);

    return result;
  } catch (err) {
    ph8Log.error('提取usage数据失败', { error: err.message });
    return { promptTokens: 0, completionTokens: 0, totalTokens: 0, cachedTokens: 0, cost: 0 };
  }
}

console.log('='.repeat(80));
console.log('🧪 PH8 费用提取测试脚本');
console.log('='.repeat(80));

const testCases = [
  {
    name: '测试用例 1: 标准 OpenAI 格式 (有 usage.cost)',
    response: {
      id: 'chatcmpl-123',
      object: 'chat.completion',
      created: 1715138625,
      model: 'gpt-4o-mini',
      choices: [{ message: { role: 'assistant', content: '你好！' } }],
      usage: {
        prompt_tokens: 12,
        completion_tokens: 8,
        total_tokens: 20,
        cost: 0.0015
      }
    }
  },
  {
    name: '测试用例 2: 有 usage.price 字段',
    response: {
      id: 'chatcmpl-456',
      choices: [],
      usage: {
        prompt_tokens: 25,
        completion_tokens: 15,
        total_tokens: 40,
        price: 0.0020
      }
    }
  },
  {
    name: '测试用例 3: 根级 cost 字段',
    response: {
      id: 'chatcmpl-789',
      choices: [],
      usage: {
        prompt_tokens: 30,
        completion_tokens: 20,
        total_tokens: 50
      },
      cost: 0.0025
    }
  },
  {
    name: '测试用例 4: output.usage 格式 (视频)',
    response: {
      id: 'video-123',
      status: 'completed',
      output: {
        url: 'https://...',
        usage: {
          total_tokens: 100,
          cost: 0.2100
        }
      }
    }
  },
  {
    name: '测试用例 5: results 数组格式',
    response: {
      id: 'image-456',
      results: [
        {
          url: 'https://...',
          usage: {
            cost: 0.0120,
            total_tokens: 50
          }
        }
      ]
    }
  },
  {
    name: '测试用例 6: 没有任何费用数据',
    response: {
      id: 'chatcmpl-000',
      choices: [{ message: { content: '测试' } }],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15
      }
    }
  },
  {
    name: '测试用例 7: 响应头 x-ph8-cost 格式 (模拟)',
    response: {
      id: 'test-headers',
      choices: [],
      usage: { total_tokens: 30 }
    },
    headersCost: 0.0018
  }
];

testCases.forEach((test, index) =&gt; {
  console.log('\n' + '='.repeat(80));
  console.log(`📋 ${test.name}`);
  console.log('='.repeat(80));
  
  const result = extractUsage(test.response);
  
  console.log('\n✅ 测试结果:');
  if (result.cost &gt; 0) {
    console.log(`   🎉 成功提取费用: ¥${result.cost.toFixed(4)} (${Math.round(result.cost * 1000)} 积分)`);
  } else {
    console.log(`   ⚠️  未找到费用数据，返回默认值 0`);
  }
});

console.log('\n' + '='.repeat(80));
console.log('✅ 所有测试完成！');
console.log('='.repeat(80));
