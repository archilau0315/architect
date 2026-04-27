class TextAnalyzer {
  static extractKeywords(text) {
    const keywords = new Set();
    
    const domainKeywords = {
      architecture: [
        '建筑', '设计', '外观', '结构', '现代', '流线型', '公共建筑',
        '博物馆', '剧院', '体育馆', '住宅', '商业', '办公', '文化中心',
        '立面', '屋顶', '内部', '空间', '景观', '城市', '广场',
        'architecture', 'design', 'building', 'structure', 'modern', 'contemporary',
        'museum', 'theater', 'stadium', 'residential', 'commercial', 'office',
        'facade', 'roof', 'interior', 'space', 'urban', 'plaza'
      ],
      persons: [
        '扎哈·哈迪德', '托马斯·赫斯维克', '贝聿铭', '隈研吾', '弗兰克·盖里',
        'Zaha Hadid', 'Thomas Heatherwick', 'I.M. Pei', 'Kengo Kuma', 'Frank Gehry'
      ],
      locations: [
        '北京', '上海', '纽约', '伦敦', '巴黎', '悉尼', '东京',
        'Beijing', 'Shanghai', 'New York', 'London', 'Paris', 'Sydney', 'Tokyo'
      ]
    };
    
    Object.values(domainKeywords).forEach(keywordList => {
      keywordList.forEach(keyword => {
        if (text.includes(keyword)) {
          keywords.add(keyword);
        }
      });
    });
    
    const chinesePhrases = text.match(/[\u4e00-\u9fa5]{2,4}/g) || [];
    chinesePhrases.forEach(phrase => {
      const commonWords = ['的', '是', '在', '有', '和', '了', '我', '你', '他', '她', '它', '这', '那', '个', '上', '下', '前', '后', '左', '右', '中', '为', '以', '可', '能', '会', '不', '要', '去', '来', '着', '过', '呢', '吗', '吧', '啊'];
      if (!commonWords.includes(phrase) && phrase.length >= 2) {
        keywords.add(phrase);
      }
    });
    
    const englishWords = text.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g) || [];
    englishWords.forEach(word => {
      if (word.length >= 3) {
        keywords.add(word);
      }
    });
    
    return Array.from(keywords);
  }

  static identifyDomain(text) {
    const domains = {
      architecture: ['建筑', 'architecture', 'design', '结构', 'facade', 'roof', 'interior', 'building'],
      art: ['艺术', 'art', 'painting', 'sculpture', 'artist', 'gallery', 'exhibition'],
      product: ['产品', 'product', '设计', '工业设计', 'industrial design'],
      fashion: ['时尚', 'fashion', '服装', 'clothing', 'designer'],
      nature: ['自然', 'nature', '景观', 'landscape', 'natural']
    };

    for (const [domain, keywords] of Object.entries(domains)) {
      if (keywords.some(keyword => text.toLowerCase().includes(keyword.toLowerCase()))) {
        return domain;
      }
    }

    return 'general';
  }

  static analyzeText(text) {
    const keywords = this.extractKeywords(text);
    const domain = this.identifyDomain(text);

    let searchQuery = keywords.join(' ');
    
    if (domain === 'architecture') {
      searchQuery += ' building exterior interior design actual photo';
    } else if (domain === 'art') {
      searchQuery += ' artwork painting actual photo';
    } else if (domain === 'product') {
      searchQuery += ' product design actual photo';
    } else {
      searchQuery += ' actual photo';
    }

    if (keywords.length === 0) {
      searchQuery = 'architecture design building actual photo';
    }

    return {
      domain,
      main_subjects: keywords.slice(0, 5),
      attributes: {
        visual: keywords.filter(k => ['外观', '立面', '屋顶', '结构', 'facade', 'roof', 'exterior', 'interior'].includes(k)),
        context: keywords.filter(k => ['城市', '广场', '景观', 'urban', 'plaza', 'landscape'].includes(k)),
        temporal: [],
        relational: []
      },
      relationships: [],
      search_query: searchQuery.trim(),
      keywords
    };
  }
}

module.exports = TextAnalyzer;