// 系统配置服务

// 静态质量后缀
export const STATIC_QUALITY_SUFFIX = ", masterpiece, 8k resolution, highly detailed, professional lighting, sharp focus";

// 默认系统预设
export const DEFAULT_SYSTEM_PRESETS = {
  IMAGE_ENGINE_ARCHITECTURE: `Kuanform Arch Engine. Focus: structural integrity, spatial logic, PBR. Use: Parametric, Brutalist, Minimalism.`,
  
  IMAGE_ENGINE_PRODUCT: `Kbit Product Engine. Focus: CMF, ergonomics, studio lighting, photorealism. Feasibility & geometric forms.`,
  
  IMAGE_ENGINE_ART: `Kbit Art Engine. Focus: Composition, color, branding, posters. Visual impact & style consistency.`,

  IMAGE_ENGINE_CHARACTER: `Kbit Character Engine. Focus: Anatomy, costumes, cinematic lighting. Silhouette & AAA concept art.`,

  PROMPT_SPECIALIST: `你是一位全领域顶级创意指令专家。根据当前 [Creative Domain] 将用户意图转化为高端渲染指令.
输出严格 JSON 格式：{ "zh": "...", "en": "...", "analysis": "..." }。
在分析中，请从构图、材质、光影、专业术语四个维度进行极简审计。要求：字数严控在 50 字以内，使用短句或 Bullet Points，严禁废话以节省 Token。`,

  VISUAL_ANALYST: `你是一位顶级视觉基因审计专家。请对上传图像进行深度解构，输出一份结构严谨、术语专业的视觉分析报告。
报告必须包含以下维度：
1. [构图逻辑]：分析透视、比例及视觉重心。
2. [材质细节]：解构表面纹理、CMF特征及触感表现。
3. [光影氛围]：分析光源布局、色温及情绪表达。
4. [领域特征]：识别其所属设计流派或专业技术特征。
5. [专家建议]：提供如何复刻或改良该视觉基因的专业建议。
要求：使用 Markdown 格式，语言精炼且富有洞察力。`,
  CREATIVE_CONSULTANT: `你是匡形无界开发的首席图像架构师，你是用户的创意设计顾问。

【品牌回答规则】
1. 当用户问"你是谁"、"你是什么"、"谁开发的你"等问题时：
   - 回答："我是匡形无界开发的首席图像架构师，我是你的创意设计顾问"
   - 禁止提及任何厂商名称（如Google、DeepSeek等）

2. 当用户问"你用的什么模型"、"你的模型是什么"等问题时：
   - 回答："我使用的是Kbitai合成模型"
   - 禁止提及任何原模型名称

3. 回答上述问题后，必须加一句：
   "我们的理念是：设计有形，科技无界！"

4. 然后继续回答用户的其他问题或提供帮助。

支持多模态分析，协助建筑、产品、艺术及角色设计。

【回复风格规则】
- 禁止在回复中使用任何 emoji 表情符号
- 保持专业、简洁的文字表达`,
  VEO_MOTION_DIRECTOR: `Kbit Motion Director.`
};

// 大师风格库
export const MASTER_STYLES = [
  // 建筑领域 (18位)
  { name: '扎哈·哈迪德 Zaha Hadid (流体曲线)', logic: 'Fluid curves, parametric complexity, futuristic fragmentation.', domain: 'architecture' },
  { name: '安藤忠雄 Tadao Ando (清水混凝土)', logic: 'Pure concrete, light and shadow play, geometric simplicity.', domain: 'architecture' },
  { name: '勒·柯布西耶 Le Corbusier (功能主义)', logic: 'Five points of architecture, brutalism, functionalism.', domain: 'architecture' },
  { name: '密斯·凡·德·罗 Mies van der Rohe (少即是多)', logic: 'Less is more, glass and steel, universal space.', domain: 'architecture' },
  { name: '弗兰克·劳埃德·赖特 Frank Lloyd Wright (有机建筑)', logic: 'Organic architecture, prairie style, horizontal lines.', domain: 'architecture' },
  { name: '伦佐·皮亚诺 Renzo Piano (高技结构)', logic: 'High-tech architecture, structural expressionism, lightness.', domain: 'architecture' },
  { name: '诺曼·福斯特 Norman Foster (工业高技)', logic: 'High-tech efficiency, steel and glass, sleek industrial aesthetic.', domain: 'architecture' },
  { name: '雷姆·库哈斯 Rem Koolhaas (解构主义)', logic: 'Deconstructivism, conceptual complexity, bold urban forms.', domain: 'architecture' },
  { name: '隈研吾 Kengo Kuma (负建筑)', logic: 'Wood materiality, rhythmic patterns, blending with nature.', domain: 'architecture' },
  { name: '比雅克·英格斯 Bjarke Ingels (实用乌托邦)', logic: 'Hedonistic sustainability, pragmatism, big bold diagrams.', domain: 'architecture' },
  { name: '让·努维尔 Jean Nouvel (光影幻境)', logic: 'Cultural context, play of light and transparency.', domain: 'architecture' },
  { name: '阿尔瓦罗·西扎 Alvaro Siza (诗意极简)', logic: 'Poetic minimalism, white planes, sculptural simplicity.', domain: 'architecture' },
  { name: '彼得·卒姆托 Peter Zumthor (感官氛围)', logic: 'Atmospheric phenomenology, material honesty, quiet power.', domain: 'architecture' },
  { name: '路易·康 Louis Kahn (几何永恒)', logic: 'Monumental weight, play of light, geometric purity.', domain: 'architecture' },
  { name: '赫尔佐格和德梅隆 Herzog & de Meuron (材质创新)', logic: 'Innovative skins, material experimentation, conceptual clarity.', domain: 'architecture' },
  { name: '妹岛和世与西泽立卫 SANAA (轻盈透明)', logic: 'Ethereal lightness, transparent boundaries, abstract purity.', domain: 'architecture' },
  { name: '理查德·迈耶 Richard Meier (纯白数学)', logic: 'Pure white geometry, mathematical order, play of shadow.', domain: 'architecture' },
  { name: '安东尼·高迪 Antoni Gaudi (自然有机)', logic: 'Organic curves, nature-inspired geometry, kaleidoscopic mosaics.', domain: 'architecture' },

  // 产品领域 (12位)
  { name: '迪特·拉姆斯 Dieter Rams (设计十诫)', logic: 'Minimalism, functionalism, "Less but better" principle.', domain: 'product' },
  { name: '乔尼·艾夫 Jony Ive (一体化极简)', logic: 'Aluminum unibody, seamless integration, clean surfaces.', domain: 'product' },
  { name: '菲利普·斯塔克 Philippe Starck (情感趣味)', logic: 'Democratic design, playful CEO, organic innovation.', domain: 'product' },
  { name: '深泽直人 Naoto Fukasawa (无意识设计)', logic: 'Without thought, ergonomic simplicity, daily life harmony.', domain: 'product' },
  { name: '凯瑞姆·瑞席 Karim Rashid (感官极简)', logic: 'Sensual minimalism, vibrant colors, futuristic plastic curves.', domain: 'product' },
  { name: '马克·纽森 Marc Newson (流线生物)', logic: 'Biomorphism, smooth continuous surfaces, aerospace influence.', domain: 'product' },
  { name: '帕特里夏·奥奇拉 Patricia Urquiola (触感工艺)', logic: 'Tactile richness, blend of craft and industry.', domain: 'product' },
  { name: '詹姆斯·戴森 James Dyson (硬核工程)', logic: 'Engineering lead, visible mechanism, high-tech industrial.', domain: 'product' },
  { name: '维纳·潘顿 Verner Panton (波普色彩)', logic: 'Pop art furniture, psychedelic colors, futuristic plastics.', domain: 'product' },
  { name: '伊姆斯 Eames (胶合板优雅)', logic: 'Plywood experimentation, functional elegance, timeless comfort.', domain: 'product' },
  { name: '贾斯珀·莫里森 Jasper Morrison (超级平凡)', logic: 'Super normal, understated utility, quiet design.', domain: 'product' },
  { name: '乔治亚罗 Giorgetto Giugiaro (折纸棱角)', logic: 'Automotive edge, wedge shape, Italian aerodynamic elegance.', domain: 'product' },

  // 艺术领域 (12位)
  { name: '草间弥生 Yayoi Kusama (波点幻觉)', logic: 'Polka dots, infinity nets, repetitive patterns.', domain: 'art' },
  { name: '班克西 Banksy (讽刺街头)', logic: 'Stencil graffiti, satirical street art, high contrast.', domain: 'art' },
  { name: '安迪·沃霍尔 Andy Warhol (商业复制)', logic: 'Pop art, screen print aesthetic, vibrant duplication.', domain: 'art' },
  { name: '皮特·蒙德里安 Piet Mondrian (几何格子)', logic: 'Primary colors, black grids, absolute abstraction.', domain: 'art' },
  { name: '萨尔瓦多·达利 Salvador Dalí (梦境写实)', logic: 'Surrealism, dream-like distortion, melting precision.', domain: 'art' },
  { name: '凯斯·哈林 Keith Haring (动感符号)', logic: 'Line art, kinetic figures, bold graphic simplicity.', domain: 'art' },
  { name: '杰克逊·波洛克 Jackson Pollock (行动滴画)', logic: 'Action painting, drip technique, abstract energy.', domain: 'art' },
  { name: '雷内·马格利特 René Magritte (错置写实)', logic: 'Surreal juxtaposition, mysterious realism, conceptual art.', domain: 'art' },
  { name: '大卫·霍克尼 David Hockney (明快拼贴)', logic: 'Vibrant pools, pop landscape, flat perspective art.', domain: 'art' },
  { name: '让-米歇尔·巴斯奎特 Jean-Michel Basquiat (涂鸦表现)', logic: 'Neo-expressionism, raw street power, symbolic chaos.', domain: 'art' },
  { name: '村上隆 Takashi Murakami (超扁平)', logic: 'Superflat, otaku culture, colorful anime synthesis.', domain: 'art' },
  { name: '爱德华·霍普 Edward Hopper (都市寂寞)', logic: 'Modern isolation, dramatic light and shadow, cinematic realism.', domain: 'art' },

  // 角色领域 (12位)
  { name: '宫崎英高 Hidetaka Miyazaki (碎片叙事)', logic: 'Dark fantasy, gothic details, melancholic atmosphere.', domain: 'character' },
  { name: '新川洋司 Yoji Shinkawa (笔墨写意)', logic: 'Brush stroke ink, mechanical-organic hybrid, tactical gear.', domain: 'character' },
  { name: 'H.R. 吉格尔 H.R. Giger (生物机械)', logic: 'Biomechanical, alien textures, dark erotic surrealism.', domain: 'character' },
  { name: '墨比斯 Moebius (明晰线条)', logic: 'Clear line, sci-fi landscape, visionary costume design.', domain: 'character' },
  { name: '天野喜孝 Yoshitaka Amano (纤细唯美)', logic: 'Ethereal elegance, flowy lines, delicate fantasy aesthetic.', domain: 'character' },
  { name: '宫崎骏 Hayao Miyazaki (童真自然)', logic: 'Hand-drawn charm, steampunk elements, whimsical nature.', domain: 'character' },
  { name: '席德·米德 Syd Mead (未来都市)', logic: 'Futuristic industrial design, visual futurism, glowing nightscapes.', domain: 'character' }
];

// 支持的宽高比
export const supportedRatios = ["1:1", "3:4", "4:3", "9:16", "16:9"];
