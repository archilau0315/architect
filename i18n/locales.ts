// 多语言配置文件
export type Language = 'zh-CN' | 'en-US' | 'ja-JP' | 'ko-KR' | 'es-ES' | 'fr-FR' | 'de-DE' | 'ru-RU';

export interface Translations {
  // 通用
  common: {
    confirm: string;
    cancel: string;
    save: string;
    delete: string;
    edit: string;
    close: string;
    reset: string;
    loading: string;
    success: string;
    error: string;
    search: string;
    upload: string;
    download: string;
    copy: string;
    paste: string;
    cut: string;
  };

  // 主界面
  main: {
    welcome: string;
    welcomeMessage: string;
    newChat: string;
    newConversation: string;
    settings: string;
    logout: string;
    profile: string;
  };

  // 侧边栏
  sidebar: {
    conversations: string;
    history: string;
    favorites: string;
    newGroup: string;
    newSession: string;
    rename: string;
    delete: string;
    todayConversations: string;
  };

  // 标签页
  tabs: {
    chat: string;
    architect: string;
    video: string;
    imageGen: string;
    imageAnalyze: string;
  };

  // 领域
  domains: {
    architecture: string;
    product: string;
    art: string;
    character: string;
  };

  // 设置面板
  settings: {
    title: string;
    subtitle: string;

    // 标签页
    tabs: {
      preferences: string;
      account: string;
      subscription: string;
      agreement: string;
      about: string;
      system: string;
    };

    // 界面偏好
    preferences: {
      title: string;
      subtitle: string;
      theme: string;
      themeDesc: string;
      themePreview: string;
      themePreviewDesc: string;
      fontSize: string;
      fontSizeDesc: string;
      fontSizeTip: string;
      language: string;
      languageDesc: string;
      resetToDefault: string;
      resetConfirm: string;
    };

    // 主题名称
    themes: {
      dark: string;
      light: string;
      indigo: string;
      ocean: string;
      forest: string;
      sunset: string;
      minimal: string;
    };

    // 字号
    fontSizes: {
      small: string;
      medium: string;
      large: string;
    };
  };

  // 账户
  account: {
    title: string;
    logout: string;
    tier: string;
    points: string;
    dailyPoints: string;
    purchasedPoints: string;
    totalPoints: string;
    balance: string;
    dailyBalance: string;
    consumed: string;
  };

  // 按钮
  buttons: {
    themeButton: string;
    borderButton: string;
    generate: string;
    regenerate: string;
    send: string;
    clear: string;
    export: string;
    import: string;
    // 对话界面
    stopGenerate: string;
    rerender: string;
    inpaint: string;
    analyzeImage: string;
    reversePrompt: string;
    jsonPrompt: string;
    // 快捷提示词
    thinkingText: string;
    generatingImage: string;
    generatingVideo: string;
    inpainting: string;
    cancelled: string;
    videoGenerationFailed: string;
    quantity: string;
    // 气泡操作栏
    stdDownload: string;
    originalDownload: string;
    originalDownloadLocked: string;
    unlockOriginal: string;
    fullscreen: string;
    inpaintShort: string;
    hdShort: string;
    undo: string;
    imageCount: string;
    inpaintConfirm: string;
  };

  // 参数设置
  parameters: {
    title: string;
    aspectRatio: string;
    resolution: string;
    engine: string;
    count: string;
    temperature: string;
    topP: string;
    seed: string;
    videoLength: string;
    // 图像生成参数
    imageSize: string;
    quality: string;
    advanced: string;
    custom: string;
    customPlaceholder: string;
    fast: string;
    highQuality: string;
    lockSeed: string;
    unlockSeed: string;
    random: string;
    // 视频生成参数
    model: string;
    duration: string;
    cameraMotionTip: string;
    // 高清放大
    hdUpscale: string;
    inpaintEdit: string;
    selectUpscaleOption: string;
    currentSize: string;
    upscaleHint: string;
    engineLabel: string;
    targetRes: string;
    recommended: string;
    alreadyMax2K: string;
    alreadyMax4K: string;
    upscaleFailed: string;
    upscaling: string;
  };

  // 预设风格面板
  presets: {
    title: string;
    clearAll: string;
    masterStyles: string;
    architecture: { label: string; tags: string[] }[];
    product: { label: string; tags: string[] }[];
    art: { label: string; tags: string[] }[];
    character: { label: string; tags: string[] }[];
  };
}

export const translations: Record<Language, Translations> = {
  'zh-CN': {
    common: {
      confirm: '确认',
      cancel: '取消',
      save: '保存',
      delete: '删除',
      edit: '编辑',
      close: '关闭',
      reset: '重置',
      loading: '加载中...',
      success: '成功',
      error: '错误',
      search: '搜索',
      upload: '上传',
      download: '下载',
      copy: '复制',
      paste: '粘贴',
      cut: '剪切',
    },
    main: {
      welcome: '你好，有什么可以帮你？',
      welcomeMessage: '欢迎使用首席图像架构师',
      newChat: '新对话',
      newConversation: '新建对话',
      settings: '设置',
      logout: '退出登录',
      profile: '个人资料',
    },
    sidebar: {
      conversations: '对话列表',
      history: '历史记录',
      favorites: '收藏夹',
      newGroup: '新建分组',
      newSession: '新建对话',
      rename: '重命名',
      delete: '删除',
      todayConversations: '今日对话',
    },
    tabs: {
      chat: '对话',
      architect: '渲染',
      video: '视频',
      imageGen: '图像生成',
      imageAnalyze: '图像分析',
    },
    domains: {
      architecture: '建筑空间',
      product: '产品设计',
      art: '视觉艺术',
      character: '角色概念',
    },
    settings: {
      title: '管控中心',
      subtitle: 'Command Center',
      tabs: {
        preferences: '界面偏好',
        account: '账户体系',
        subscription: '订阅计费',
        agreement: '用户协议',
        about: '关于我们',
        system: '核心指令',
      },
      preferences: {
        title: '界面偏好',
        subtitle: 'Interface Preferences',
        theme: '主题风格',
        themeDesc: '选择您喜欢的界面主题',
        themePreview: '主题效果预览',
        themePreviewDesc: '切换主题后，此区域会显示对应的主题色',
        fontSize: '字号大小',
        fontSizeDesc: '调整界面文字大小',
        fontSizeTip: '💡 提示：字号调整会影响整个界面的文字大小',
        language: '界面语言',
        languageDesc: '选择界面显示语言',
        resetToDefault: '重置为默认设置',
        resetConfirm: '确定要重置所有界面偏好设置吗？',
      },
      themes: {
        dark: '暗黑',
        light: '明亮',
        indigo: '紫罗兰',
        ocean: '赛博青',
        forest: '翡翠绿',
        sunset: '创意橙',
        minimal: '极简灰',
      },
      fontSizes: {
        small: '小',
        medium: '标准',
        large: '大',
      },
    },
    account: {
      title: '账户信息',
      logout: '退出登录',
      tier: '用户等级',
      points: '积分余额',
      dailyPoints: '每日积分',
      purchasedPoints: '购买积分',
      totalPoints: '总积分',
      balance: '总余额',
      dailyBalance: '日余额',
      consumed: '消耗',
    },
    buttons: {
      themeButton: '主题按钮',
      borderButton: '边框按钮',
      generate: '生成',
      regenerate: '重新生成',
      send: '发送',
      clear: '清空',
      export: '导出',
      import: '导入',
      stopGenerate: '停止生成',
      rerender: '再次渲染',
      inpaint: '局部修改',
      analyzeImage: '图像分析',
      reversePrompt: '反推提示词',
      jsonPrompt: 'JSON提示词',
      thinkingText: '思考中…',
      generatingImage: '生成图像中…',
      generatingVideo: '生成视频中，请稍候…',
      inpainting: '局部修改中…',
      cancelled: '已取消',
      videoGenerationFailed: '视频生成失败',
      quantity: '数量',
      stdDownload: '下载',
      originalDownload: '原图',
      originalDownloadLocked: '原图🔒',
      unlockOriginal: '升级 PRO/PLUS 解锁无水印原图下载',
      fullscreen: '全屏',
      inpaintShort: '局部改',
      hdShort: '高清',
      undo: '回退',
      imageCount: '图',
      inpaintConfirm: '将对图 {n} 进行局部修改，确认？',
    },
    parameters: {
      title: '参数设置',
      aspectRatio: '画布比例',
      resolution: '解算精度',
      engine: '解算引擎',
      count: '生成数量',
      temperature: '温度',
      topP: '多样性',
      seed: '随机种子',
      videoLength: '视频时长',
      imageSize: '尺寸',
      quality: '质量',
      advanced: '高级',
      custom: '自定义',
      customPlaceholder: '如 2:3',
      fast: '快速',
      highQuality: '高质',
      lockSeed: '固定随机种子',
      unlockSeed: '解锁随机种子',
      random: '随机',
      model: '模型',
      duration: '时长',
      cameraMotionTip: '💡 提示：请在提示词中描述运镜效果，如"镜头缓慢推进"、"从左向右平移"、"环绕旋转"等',
      hdUpscale: '高清放大',
      inpaintEdit: '局部修改',
      selectUpscaleOption: '选择放大选项',
      currentSize: '当前图片尺寸：',
      upscaleHint: '放大后的图片将传入底图栏第一栏位',
      engineLabel: '解算引擎',
      targetRes: '目标分辨率',
      recommended: '推荐',
      alreadyMax2K: '当前图片已达 2K 或以上，请直接使用 4K 放大',
      alreadyMax4K: '当前图片已是 4K 分辨率，无需放大',
      upscaleFailed: '放大失败',
      upscaling: '正在 {size} 高清放大...',    },
    presets: {
      title: '预设风格',
      clearAll: '清除全部',
      masterStyles: '大师风格',
      architecture: [
        { label: '时段环境', tags: ['晨曦 Dawn', '正午 Noon', '黄金时刻 Golden Hour', '蓝调时刻 Blue Hour', '暮色 Dusk', '深夜 Deep Night'] },
        { label: '建筑风格', tags: ['极简主义 Minimalism', '赛博朋克 Cyberpunk', '侘寂 Wabi-sabi', '包豪斯 Bauhaus', '参数化主义 Parametric', '野兽主义 Brutalism'] },
        { label: '材质纹理', tags: ['清水混凝土', '中空玻璃', '原木质感', '烧毛面花岗岩', '手工黏土砖', '不锈钢蒙皮'] },
        { label: '气象光影', tags: ['丁达尔效应', '全局光照', '逆光 Cinematic', '柔和扩散', '体积云', '大雾 Dense Fog'] },
      ],
      product: [
        { label: '产品分类', tags: ['智能手机', '高端腕表', '极简家具', '电动汽车', '工业无人机', '人体工学椅'] },
        { label: 'CMF 工艺', tags: ['阳极氧化铝', '碳纤维纹理', '拉丝不锈钢', '喷砂工艺', '高光陶瓷', '透明亚克力'] },
        { label: '影棚灯光', tags: ['三点布光', '边缘勾勒光', '柔光箱', '顶部环形灯', '焦外虚化', '微距特写'] },
      ],
      art: [
        { label: '艺术流派', tags: ['波普艺术 Pop Art', '超现实主义', '印象派', '抽象表现主义', '蒸汽波 Vaporwave', '故障艺术 Glitch'] },
        { label: '视觉要素', tags: ['极简排版', '大胆对比色', '波尔卡圆点', '几何重组', '液体流动感', '噪点肌理'] },
        { label: '表现媒介', tags: ['丝网印刷', '油画笔触', '矢量插画', '3D 渲染', '水墨晕染', '拼贴艺术'] },
      ],
      character: [
        { label: '角色原型', tags: ['赛博武士', '暗黑巫师', '未来士兵', '机甲驾驶员', '荒原流浪者', '维多利亚绅士'] },
        { label: '装备材质', tags: ['战损盔甲', '战术尼龙', '仿生肌肉', '做旧皮革', '发光排线', '全息目镜'] },
        { label: '氛围呈现', tags: ['史诗级宏大', '电影级构图', '剪影表现', '暗黑压抑', '圣洁之光', '鲜血溅射'] },
      ],
    },
  },

  'en-US': {
    common: {
      confirm: 'Confirm',
      cancel: 'Cancel',
      save: 'Save',
      delete: 'Delete',
      edit: 'Edit',
      close: 'Close',
      reset: 'Reset',
      loading: 'Loading...',
      success: 'Success',
      error: 'Error',
      search: 'Search',
      upload: 'Upload',
      download: 'Download',
      copy: 'Copy',
      paste: 'Paste',
      cut: 'Cut',
    },
    main: {
      welcome: 'Hello, how can I help you?',
      welcomeMessage: 'Welcome to Chief Image Architect',
      newChat: 'New Chat',
      newConversation: 'New Conversation',
      settings: 'Settings',
      logout: 'Logout',
      profile: 'Profile',
    },
    sidebar: {
      conversations: 'Conversations',
      history: 'History',
      favorites: 'Favorites',
      newGroup: 'New Group',
      newSession: 'New Session',
      rename: 'Rename',
      delete: 'Delete',
      todayConversations: 'Today\'s Conversations',
    },
    tabs: {
      chat: 'Chat',
      architect: 'Render',
      video: 'Video',
      imageGen: 'Image Generation',
      imageAnalyze: 'Image Analysis',
    },
    domains: {
      architecture: 'Architecture',
      product: 'Product Design',
      art: 'Visual Art',
      character: 'Character Concept',
    },
    settings: {
      title: 'Control Center',
      subtitle: 'Command Center',
      tabs: {
        preferences: 'Preferences',
        account: 'Account',
        subscription: 'Subscription',
        agreement: 'Agreement',
        about: 'About',
        system: 'System',
      },
      preferences: {
        title: 'Interface Preferences',
        subtitle: 'Customize Your Experience',
        theme: 'Theme Style',
        themeDesc: 'Choose your preferred interface theme',
        themePreview: 'Theme Preview',
        themePreviewDesc: 'This area shows the theme color when you switch themes',
        fontSize: 'Font Size',
        fontSizeDesc: 'Adjust interface text size',
        fontSizeTip: '💡 Tip: Font size adjustment affects all text in the interface',
        language: 'Language',
        languageDesc: 'Select interface language',
        resetToDefault: 'Reset to Default',
        resetConfirm: 'Are you sure you want to reset all preferences?',
      },
      themes: {
        dark: 'Dark',
        light: 'Light',
        indigo: 'Indigo',
        ocean: 'Ocean',
        forest: 'Forest',
        sunset: 'Sunset',
        minimal: 'Minimal',
      },
      fontSizes: {
        small: 'Small',
        medium: 'Medium',
        large: 'Large',
      },
    },
    account: {
      title: 'Account Info',
      logout: 'Logout',
      tier: 'User Tier',
      points: 'Points Balance',
      dailyPoints: 'Daily Points',
      purchasedPoints: 'Purchased Points',
      totalPoints: 'Total Points',
      balance: 'Total Balance',
      dailyBalance: 'Daily Balance',
      consumed: 'Consumed',
    },
    buttons: {
      themeButton: 'Theme Button',
      borderButton: 'Border Button',
      generate: 'Generate',
      regenerate: 'Regenerate',
      send: 'Send',
      clear: 'Clear',
      export: 'Export',
      import: 'Import',
      stopGenerate: 'Stop',
      rerender: 'Regenerate',
      inpaint: 'Inpaint',
      analyzeImage: 'Analyze Image',
      reversePrompt: 'Reverse Prompt',
      jsonPrompt: 'JSON Prompt',
      thinkingText: 'Thinking...',
      generatingImage: 'Generating image...',
      generatingVideo: 'Generating video, please wait...',
      inpainting: 'Inpainting...',
      cancelled: 'Cancelled',
      videoGenerationFailed: 'Video generation failed',
      quantity: 'Quantity',
      stdDownload: 'Download',
      originalDownload: 'Original',
      originalDownloadLocked: 'Original🔒',
      unlockOriginal: 'Upgrade PRO/PLUS to unlock watermark-free download',
      fullscreen: 'Fullscreen',
      inpaintShort: 'Inpaint',
      hdShort: 'HD',
      undo: 'Undo',
      imageCount: 'Img',
      inpaintConfirm: 'Inpaint image {n}. Confirm?',
    },
    parameters: {
      title: 'Parameters',
      aspectRatio: 'Aspect Ratio',
      resolution: 'Resolution',
      engine: 'Engine Tier',
      count: 'Count',
      temperature: 'Temperature',
      topP: 'Top P',
      seed: 'Seed',
      videoLength: 'Video Length',
      imageSize: 'Size',
      quality: 'Quality',
      advanced: 'Advanced',
      custom: 'Custom',
      customPlaceholder: 'e.g. 2:3',
      fast: 'Fast',
      highQuality: 'HQ',
      lockSeed: 'Lock seed',
      unlockSeed: 'Unlock seed',
      random: 'Random',
      model: 'Model',
      duration: 'Duration',
      cameraMotionTip: '💡 Tip: Describe camera motion in your prompt, e.g., "slow zoom in", "pan left to right", "orbit around"',
      hdUpscale: 'HD Upscale',
      inpaintEdit: 'Inpaint',
      selectUpscaleOption: 'Select Upscale Option',
      currentSize: 'Current size: ',
      upscaleHint: 'Upscaled image will be placed in the first base slot',
      engineLabel: 'Engine',
      targetRes: 'Target Resolution',
      recommended: 'Best',
      alreadyMax2K: 'Image is already 2K or above, use 4K upscale instead',
      alreadyMax4K: 'Image is already 4K, no upscale needed',
      upscaleFailed: 'Upscale failed',
      upscaling: 'Upscaling to {size}...',    },
    presets: {
      title: 'Style Presets',
      clearAll: 'Clear All',
      masterStyles: 'Master Styles',
      architecture: [
        { label: 'Time & Atmosphere', tags: ['Dawn', 'Noon', 'Golden Hour', 'Blue Hour', 'Dusk', 'Deep Night'] },
        { label: 'Arch Style', tags: ['Minimalism', 'Cyberpunk', 'Wabi-sabi', 'Bauhaus', 'Parametric', 'Brutalism'] },
        { label: 'Material', tags: ['Bare Concrete', 'Hollow Glass', 'Raw Wood', 'Flamed Granite', 'Clay Brick', 'Steel Skin'] },
        { label: 'Light & Weather', tags: ['Tyndall Effect', 'Global Illumination', 'Backlit Cinematic', 'Soft Diffusion', 'Volumetric Cloud', 'Dense Fog'] },
      ],
      product: [
        { label: 'Product Type', tags: ['Smartphone', 'Luxury Watch', 'Minimal Furniture', 'EV Car', 'Industrial Drone', 'Ergonomic Chair'] },
        { label: 'CMF Process', tags: ['Anodized Aluminum', 'Carbon Fiber', 'Brushed Steel', 'Sandblasted', 'Glossy Ceramic', 'Clear Acrylic'] },
        { label: 'Studio Lighting', tags: ['Three-Point Light', 'Rim Light', 'Softbox', 'Ring Light', 'Bokeh', 'Macro Close-up'] },
      ],
      art: [
        { label: 'Art Movement', tags: ['Pop Art', 'Surrealism', 'Impressionism', 'Abstract Expressionism', 'Vaporwave', 'Glitch Art'] },
        { label: 'Visual Elements', tags: ['Minimal Typography', 'Bold Contrast', 'Polka Dots', 'Geometric Remix', 'Liquid Flow', 'Noise Texture'] },
        { label: 'Medium', tags: ['Screen Print', 'Oil Brushstroke', 'Vector Illustration', '3D Render', 'Ink Wash', 'Collage'] },
      ],
      character: [
        { label: 'Archetype', tags: ['Cyber Samurai', 'Dark Wizard', 'Future Soldier', 'Mech Pilot', 'Wasteland Wanderer', 'Victorian Gentleman'] },
        { label: 'Gear Material', tags: ['Battle-worn Armor', 'Tactical Nylon', 'Bionic Muscle', 'Aged Leather', 'Glowing Wires', 'Holographic Visor'] },
        { label: 'Atmosphere', tags: ['Epic Grand', 'Cinematic Composition', 'Silhouette', 'Dark Oppressive', 'Holy Light', 'Blood Splatter'] },
      ],
    },
  },

  'ja-JP': {
    common: {
      confirm: '確認',
      cancel: 'キャンセル',
      save: '保存',
      delete: '削除',
      edit: '編集',
      close: '閉じる',
      reset: 'リセット',
      loading: '読み込み中...',
      success: '成功',
      error: 'エラー',
      search: '検索',
      upload: 'アップロード',
      download: 'ダウンロード',
      copy: 'コピー',
      paste: '貼り付け',
      cut: '切り取り',
    },
    main: {
      welcome: 'こんにちは、何かお手伝いできますか？',
      welcomeMessage: 'チーフイメージアーキテクトへようこそ',
      newChat: '新しいチャット',
      newConversation: '新しい会話',
      settings: '設定',
      logout: 'ログアウト',
      profile: 'プロフィール',
    },
    sidebar: {
      conversations: '会話リスト',
      history: '履歴',
      favorites: 'お気に入り',
      newGroup: '新しいグループ',
      newSession: '新しいセッション',
      rename: '名前を変更',
      delete: '削除',
      todayConversations: '今日の会話',
    },
    tabs: {
      chat: 'チャット',
      architect: 'レンダリング',
      video: 'ビデオ',
      imageGen: '画像生成',
      imageAnalyze: '画像分析',
    },
    domains: {
      architecture: '建築空間',
      product: '製品デザイン',
      art: 'ビジュアルアート',
      character: 'キャラクターコンセプト',
    },
    settings: {
      title: 'コントロールセンター',
      subtitle: 'Command Center',
      tabs: {
        preferences: '設定',
        account: 'アカウント',
        subscription: 'サブスクリプション',
        agreement: '利用規約',
        about: '概要',
        system: 'システム',
      },
      preferences: {
        title: 'インターフェース設定',
        subtitle: 'カスタマイズ',
        theme: 'テーマスタイル',
        themeDesc: 'お好みのテーマを選択',
        themePreview: 'テーマプレビュー',
        themePreviewDesc: 'テーマを切り替えると、この領域に対応するテーマカラーが表示されます',
        fontSize: 'フォントサイズ',
        fontSizeDesc: 'テキストサイズを調整',
        fontSizeTip: '💡 ヒント：フォントサイズの調整はインターフェース全体のテキストサイズに影響します',
        language: '言語',
        languageDesc: 'インターフェース言語を選択',
        resetToDefault: 'デフォルトに戻す',
        resetConfirm: 'すべての設定をリセットしますか？',
      },
      themes: {
        dark: 'ダーク',
        light: 'ライト',
        indigo: 'インディゴ',
        ocean: 'オーシャン',
        forest: 'フォレスト',
        sunset: 'サンセット',
        minimal: 'ミニマル',
      },
      fontSizes: {
        small: '小',
        medium: '中',
        large: '大',
      },
    },
    account: {
      title: 'アカウント情報',
      logout: 'ログアウト',
      tier: 'ユーザーレベル',
      points: 'ポイント残高',
      dailyPoints: '毎日のポイント',
      purchasedPoints: '購入ポイント',
      totalPoints: '合計ポイント',
      balance: '総残高',
      dailyBalance: '日次残高',
      consumed: '消費',
    },
    buttons: {
      themeButton: 'テーマボタン',
      borderButton: 'ボーダーボタン',
      generate: '生成',
      regenerate: '再生成',
      send: '送信',
      clear: 'クリア',
      export: 'エクスポート',
      import: 'インポート',
      stopGenerate: '停止',
      rerender: '再レンダリング',
      inpaint: '部分修正',
      analyzeImage: '画像分析',
      reversePrompt: 'プロンプト逆算',
      jsonPrompt: 'JSONプロンプト',
      thinkingText: '考え中...',
      generatingImage: '画像生成中...',
      generatingVideo: 'ビデオ生成中、お待ちください...',
      inpainting: '部分修正中...',
      cancelled: 'キャンセルされました',
      videoGenerationFailed: 'ビデオ生成失敗',
      quantity: '数量',
      stdDownload: 'ダウンロード',
      originalDownload: '原画',
      originalDownloadLocked: '原画🔒',
      unlockOriginal: 'PRO/PLUSにアップグレードして透かしなし原画をダウンロード',
      fullscreen: '全画面',
      inpaintShort: '部分編集',
      hdShort: 'HD',
      undo: '元に戻す',
      imageCount: '枚',
      inpaintConfirm: '画像 {n} を部分編集します。確認しますか？',
    },
    parameters: {
      title: 'パラメータ設定',
      aspectRatio: 'アスペクト比',
      resolution: '解像度',
      engine: 'エンジン',
      count: '生成数',
      temperature: '温度',
      topP: '多様性',
      seed: 'シード',
      videoLength: 'ビデオ長',
      imageSize: 'サイズ',
      quality: '品質',
      advanced: '詳細',
      custom: 'カスタム',
      customPlaceholder: '例: 2:3',
      fast: '高速',
      highQuality: '高品質',
      lockSeed: 'シードを固定',
      unlockSeed: 'シードを解除',
      random: 'ランダム',
      model: 'モデル',
      duration: '時間',
      cameraMotionTip: '💡 ヒント：プロンプトでカメラの動きを説明してください。例：「ゆっくりズームイン」「左から右へパン」「周回」',
      hdUpscale: '高解像度拡大',
      inpaintEdit: '部分編集',
      selectUpscaleOption: '拡大オプションを選択',
      currentSize: '現在のサイズ：',
      upscaleHint: '拡大後の画像はベーススロット1に配置されます',
      engineLabel: 'エンジン',
      targetRes: 'ターゲット解像度',
      recommended: 'おすすめ',
      alreadyMax2K: '画像はすでに2K以上です。4K拡大を使用してください',
      alreadyMax4K: '画像はすでに4Kです。拡大不要です',
      upscaleFailed: '拡大失敗',
      upscaling: '{size}に拡大中...',    },
    presets: {
      title: 'スタイルプリセット',
      clearAll: 'すべてクリア',
      masterStyles: 'マスタースタイル',
      architecture: [
        { label: '時間帯・雰囲気', tags: ['夜明け', '正午', 'ゴールデンアワー', 'ブルーアワー', '夕暮れ', '深夜'] },
        { label: '建築スタイル', tags: ['ミニマリズム', 'サイバーパンク', '侘び寂び', 'バウハウス', 'パラメトリック', 'ブルータリズム'] },
        { label: '素材・テクスチャ', tags: ['打放しコンクリート', '中空ガラス', '無垢材', '焼き花崗岩', '手作りレンガ', 'ステンレス外装'] },
        { label: '光・天候', tags: ['チンダル効果', 'グローバルイルミネーション', '逆光', '柔らかい拡散光', '体積雲', '濃霧'] },
      ],
      product: [
        { label: '製品カテゴリ', tags: ['スマートフォン', '高級時計', 'ミニマル家具', 'EV車', '産業用ドローン', 'エルゴノミクスチェア'] },
        { label: 'CMF加工', tags: ['アルマイト処理', 'カーボンファイバー', 'ヘアライン仕上げ', 'サンドブラスト', '光沢セラミック', '透明アクリル'] },
        { label: 'スタジオ照明', tags: ['三点照明', 'リムライト', 'ソフトボックス', 'リングライト', 'ボケ', 'マクロ接写'] },
      ],
      art: [
        { label: 'アートムーブメント', tags: ['ポップアート', 'シュルレアリスム', '印象派', '抽象表現主義', 'ヴェイパーウェイブ', 'グリッチアート'] },
        { label: 'ビジュアル要素', tags: ['ミニマルタイポグラフィ', '大胆なコントラスト', 'ポルカドット', '幾何学的再構成', '液体の流れ', 'ノイズテクスチャ'] },
        { label: '表現媒体', tags: ['シルクスクリーン', '油絵タッチ', 'ベクターイラスト', '3Dレンダリング', '水墨画', 'コラージュ'] },
      ],
      character: [
        { label: 'キャラクタータイプ', tags: ['サイバー侍', 'ダーク魔法使い', '未来の兵士', 'メカパイロット', '荒野の放浪者', 'ヴィクトリア紳士'] },
        { label: '装備素材', tags: ['戦傷鎧', 'タクティカルナイロン', 'バイオニック筋肉', '使い古した革', '発光ワイヤー', 'ホログラフィックバイザー'] },
        { label: '雰囲気', tags: ['壮大なスケール', '映画的構図', 'シルエット', 'ダーク抑圧', '聖なる光', '血しぶき'] },
      ],
    },
  },

  'ko-KR': {
    common: {
      confirm: '확인',
      cancel: '취소',
      save: '저장',
      delete: '삭제',
      edit: '편집',
      close: '닫기',
      reset: '재설정',
      loading: '로딩 중...',
      success: '성공',
      error: '오류',
      search: '검색',
      upload: '업로드',
      download: '다운로드',
      copy: '복사',
      paste: '붙여넣기',
      cut: '잘라내기',
    },
    main: {
      welcome: '안녕하세요, 무엇을 도와드릴까요?',
      welcomeMessage: '치프 이미지 아키텍트에 오신 것을 환영합니다',
      newChat: '새 채팅',
      newConversation: '새 대화',
      settings: '설정',
      logout: '로그아웃',
      profile: '프로필',
    },
    sidebar: {
      conversations: '대화 목록',
      history: '기록',
      favorites: '즐겨찾기',
      newGroup: '새 그룹',
      newSession: '새 세션',
      rename: '이름 변경',
      delete: '삭제',
      todayConversations: '오늘의 대화',
    },
    tabs: {
      chat: '채팅',
      architect: '렌더링',
      video: '비디오',
      imageGen: '이미지 생성',
      imageAnalyze: '이미지 분석',
    },
    domains: {
      architecture: '건축 공간',
      product: '제품 디자인',
      art: '비주얼 아트',
      character: '캐릭터 컨셉',
    },
    settings: {
      title: '제어 센터',
      subtitle: 'Command Center',
      tabs: {
        preferences: '환경설정',
        account: '계정',
        subscription: '구독',
        agreement: '약관',
        about: '정보',
        system: '시스템',
      },
      preferences: {
        title: '인터페이스 설정',
        subtitle: '사용자 정의',
        theme: '테마 스타일',
        themeDesc: '선호하는 테마를 선택하세요',
        themePreview: '테마 미리보기',
        themePreviewDesc: '테마를 전환하면 이 영역에 해당 테마 색상이 표시됩니다',
        fontSize: '글꼴 크기',
        fontSizeDesc: '텍스트 크기 조정',
        fontSizeTip: '💡 팁: 글꼴 크기 조정은 전체 인터페이스의 텍스트 크기에 영향을 미칩니다',
        language: '언어',
        languageDesc: '인터페이스 언어 선택',
        resetToDefault: '기본값으로 재설정',
        resetConfirm: '모든 설정을 재설정하시겠습니까?',
      },
      themes: {
        dark: '다크',
        light: '라이트',
        indigo: '인디고',
        ocean: '오션',
        forest: '포레스트',
        sunset: '선셋',
        minimal: '미니멀',
      },
      fontSizes: {
        small: '작게',
        medium: '보통',
        large: '크게',
      },
    },
    account: {
      title: '계정 정보',
      logout: '로그아웃',
      tier: '사용자 등급',
      points: '포인트 잔액',
      dailyPoints: '일일 포인트',
      purchasedPoints: '구매 포인트',
      totalPoints: '총 포인트',
      balance: '총 잔액',
      dailyBalance: '일일 잔액',
      consumed: '소비',
    },
    buttons: {
      themeButton: '테마 버튼',
      borderButton: '테두리 버튼',
      generate: '생성',
      regenerate: '재생성',
      send: '보내기',
      clear: '지우기',
      export: '내보내기',
      import: '가져오기',
      stopGenerate: '중지',
      rerender: '재렌더링',
      inpaint: '부분 수정',
      analyzeImage: '이미지 분석',
      reversePrompt: '프롬프트 역추적',
      jsonPrompt: 'JSON 프롬프트',
      thinkingText: '생각 중...',
      generatingImage: '이미지 생성 중...',
      generatingVideo: '비디오 생성 중, 잠시만 기다려주세요...',
      inpainting: '부분 수정 중...',
      cancelled: '취소됨',
      videoGenerationFailed: '비디오 생성 실패',
      quantity: '수량',
      stdDownload: '다운로드',
      originalDownload: '원본',
      originalDownloadLocked: '원본🔒',
      unlockOriginal: 'PRO/PLUS로 업그레이드하여 워터마크 없는 원본 다운로드',
      fullscreen: '전체화면',
      inpaintShort: '부분편집',
      hdShort: 'HD',
      undo: '되돌리기',
      imageCount: '장',
      inpaintConfirm: '이미지 {n}을 부분 편집합니다. 확인하시겠습니까?',
    },
    parameters: {
      title: '매개변수 설정',
      aspectRatio: '화면 비율',
      resolution: '해상도',
      engine: '엔진',
      count: '생성 수',
      temperature: '온도',
      topP: '다양성',
      seed: '시드',
      videoLength: '비디오 길이',
      imageSize: '크기',
      quality: '품질',
      advanced: '고급',
      custom: '사용자 정의',
      customPlaceholder: '예: 2:3',
      fast: '빠름',
      highQuality: '고품질',
      lockSeed: '시드 고정',
      unlockSeed: '시드 해제',
      random: '랜덤',
      model: '모델',
      duration: '시간',
      cameraMotionTip: '💡 팁: 프롬프트에서 카메라 움직임을 설명하세요. 예: "천천히 줌인", "왼쪽에서 오른쪽으로 패닝", "궤도 회전"',
      hdUpscale: 'HD 업스케일',
      inpaintEdit: '부분 편집',
      selectUpscaleOption: '업스케일 옵션 선택',
      currentSize: '현재 크기: ',
      upscaleHint: '업스케일된 이미지는 첫 번째 베이스 슬롯에 배치됩니다',
      engineLabel: '엔진',
      targetRes: '목표 해상도',
      recommended: '추천',
      alreadyMax2K: '이미지가 이미 2K 이상입니다. 4K 업스케일을 사용하세요',
      alreadyMax4K: '이미지가 이미 4K입니다. 업스케일이 필요하지 않습니다',
      upscaleFailed: '업스케일 실패',
      upscaling: '{size}로 업스케일 중...',    },
    presets: {
      title: '스타일 프리셋',
      clearAll: '모두 지우기',
      masterStyles: '마스터 스타일',
      architecture: [
        { label: '시간대·분위기', tags: ['새벽', '정오', '골든아워', '블루아워', '황혼', '심야'] },
        { label: '건축 스타일', tags: ['미니멀리즘', '사이버펑크', '와비사비', '바우하우스', '파라메트릭', '브루탈리즘'] },
        { label: '재료·질감', tags: ['노출 콘크리트', '중공 유리', '원목', '화염 화강암', '점토 벽돌', '스틸 외장'] },
        { label: '빛·날씨', tags: ['틴들 효과', '전역 조명', '역광', '부드러운 확산', '체적 구름', '짙은 안개'] },
      ],
      product: [
        { label: '제품 유형', tags: ['스마트폰', '명품 시계', '미니멀 가구', '전기차', '산업용 드론', '인체공학 의자'] },
        { label: 'CMF 공정', tags: ['아노다이징 알루미늄', '탄소섬유', '헤어라인 스틸', '샌드블라스트', '광택 세라믹', '투명 아크릴'] },
        { label: '스튜디오 조명', tags: ['3점 조명', '림 라이트', '소프트박스', '링 라이트', '보케', '매크로 클로즈업'] },
      ],
      art: [
        { label: '예술 사조', tags: ['팝아트', '초현실주의', '인상파', '추상표현주의', '베이퍼웨이브', '글리치 아트'] },
        { label: '시각 요소', tags: ['미니멀 타이포', '강렬한 대비', '폴카 도트', '기하학적 재구성', '액체 흐름', '노이즈 텍스처'] },
        { label: '표현 매체', tags: ['실크스크린', '유화 터치', '벡터 일러스트', '3D 렌더링', '수묵화', '콜라주'] },
      ],
      character: [
        { label: '캐릭터 원형', tags: ['사이버 사무라이', '다크 마법사', '미래 병사', '메카 파일럿', '황야 방랑자', '빅토리아 신사'] },
        { label: '장비 재질', tags: ['전투 손상 갑옷', '전술 나일론', '바이오닉 근육', '낡은 가죽', '발광 배선', '홀로그램 바이저'] },
        { label: '분위기', tags: ['서사적 웅장함', '영화적 구도', '실루엣', '다크 압박감', '성스러운 빛', '피 튀김'] },
      ],
    },
  },

  'es-ES': {
    common: {
      confirm: 'Confirmar',
      cancel: 'Cancelar',
      save: 'Guardar',
      delete: 'Eliminar',
      edit: 'Editar',
      close: 'Cerrar',
      reset: 'Restablecer',
      loading: 'Cargando...',
      success: 'Éxito',
      error: 'Error',
      search: 'Buscar',
      upload: 'Subir',
      download: 'Descargar',
      copy: 'Copiar',
      paste: 'Pegar',
      cut: 'Cortar',
    },
    main: {
      welcome: 'Hola, ¿en qué puedo ayudarte?',
      welcomeMessage: 'Bienvenido a Chief Image Architect',
      newChat: 'Nuevo Chat',
      newConversation: 'Nueva Conversación',
      settings: 'Configuración',
      logout: 'Cerrar Sesión',
      profile: 'Perfil',
    },
    sidebar: {
      conversations: 'Conversaciones',
      history: 'Historial',
      favorites: 'Favoritos',
      newGroup: 'Nuevo Grupo',
      newSession: 'Nueva Sesión',
      rename: 'Renombrar',
      delete: 'Eliminar',
      todayConversations: 'Conversaciones de Hoy',
    },
    tabs: {
      chat: 'Chat',
      architect: 'Renderizado',
      video: 'Video',
      imageGen: 'Generación de Imágenes',
      imageAnalyze: 'Análisis de Imágenes',
    },
    domains: {
      architecture: 'Espacio Arquitectónico',
      product: 'Diseño de Producto',
      art: 'Arte Visual',
      character: 'Concepto de Personaje',
    },
    settings: {
      title: 'Centro de Control',
      subtitle: 'Command Center',
      tabs: {
        preferences: 'Preferencias',
        account: 'Cuenta',
        subscription: 'Suscripción',
        agreement: 'Acuerdo',
        about: 'Acerca de',
        system: 'Sistema',
      },
      preferences: {
        title: 'Preferencias de Interfaz',
        subtitle: 'Personalizar',
        theme: 'Estilo de Tema',
        themeDesc: 'Elige tu tema preferido',
        themePreview: 'Vista Previa del Tema',
        themePreviewDesc: 'Esta área muestra el color del tema cuando cambias de tema',
        fontSize: 'Tamaño de Fuente',
        fontSizeDesc: 'Ajustar tamaño del texto',
        fontSizeTip: '💡 Consejo: El ajuste del tamaño de fuente afecta a todo el texto de la interfaz',
        language: 'Idioma',
        languageDesc: 'Seleccionar idioma de interfaz',
        resetToDefault: 'Restablecer Predeterminado',
        resetConfirm: '¿Estás seguro de restablecer todas las preferencias?',
      },
      themes: {
        dark: 'Oscuro',
        light: 'Claro',
        indigo: 'Índigo',
        ocean: 'Océano',
        forest: 'Bosque',
        sunset: 'Atardecer',
        minimal: 'Minimalista',
      },
      fontSizes: {
        small: 'Pequeño',
        medium: 'Mediano',
        large: 'Grande',
      },
    },
    account: {
      title: 'Información de Cuenta',
      logout: 'Cerrar Sesión',
      tier: 'Nivel de Usuario',
      points: 'Saldo de Puntos',
      dailyPoints: 'Puntos Diarios',
      purchasedPoints: 'Puntos Comprados',
      totalPoints: 'Puntos Totales',
      balance: 'Saldo Total',
      dailyBalance: 'Saldo Diario',
      consumed: 'Consumido',
    },
    buttons: {
      themeButton: 'Botón de Tema',
      borderButton: 'Botón de Borde',
      generate: 'Generar',
      regenerate: 'Regenerar',
      send: 'Enviar',
      clear: 'Limpiar',
      export: 'Exportar',
      import: 'Importar',
      stopGenerate: 'Detener',
      rerender: 'Regenerar',
      inpaint: 'Modificar Parcialmente',
      analyzeImage: 'Analizar Imagen',
      reversePrompt: 'Prompt Inverso',
      jsonPrompt: 'Prompt JSON',
      thinkingText: 'Pensando...',
      generatingImage: 'Generando imagen...',
      generatingVideo: 'Generando video, por favor espere...',
      inpainting: 'Modificando parcialmente...',
      cancelled: 'Cancelado',
      videoGenerationFailed: 'Generación de video fallida',
      quantity: 'Cantidad',
      stdDownload: 'Descargar',
      originalDownload: 'Original',
      originalDownloadLocked: 'Original🔒',
      unlockOriginal: 'Actualiza a PRO/PLUS para descargar sin marca de agua',
      fullscreen: 'Pantalla completa',
      inpaintShort: 'Retocar',
      hdShort: 'HD',
      undo: 'Deshacer',
      imageCount: 'Img',
      inpaintConfirm: 'Retocar imagen {n}. ¿Confirmar?',
    },
    parameters: {
      title: 'Configuración de Parámetros',
      aspectRatio: 'Relación de Aspecto',
      resolution: 'Resolución',
      engine: 'Motor',
      count: 'Cantidad',
      temperature: 'Temperatura',
      topP: 'Top P',
      seed: 'Semilla',
      videoLength: 'Duración del Video',
      imageSize: 'Tamaño',
      quality: 'Calidad',
      advanced: 'Avanzado',
      custom: 'Personalizado',
      customPlaceholder: 'ej. 2:3',
      fast: 'Rápido',
      highQuality: 'Alta Calidad',
      lockSeed: 'Fijar semilla',
      unlockSeed: 'Liberar semilla',
      random: 'Aleatorio',
      model: 'Modelo',
      duration: 'Duración',
      cameraMotionTip: '💡 Consejo: Describe el movimiento de cámara en tu prompt, ej. "zoom lento", "paneo de izquierda a derecha", "órbita"',
      hdUpscale: 'Ampliar HD',
      inpaintEdit: 'Edición parcial',
      selectUpscaleOption: 'Seleccionar opción de ampliación',
      currentSize: 'Tamaño actual: ',
      upscaleHint: 'La imagen ampliada se colocará en el primer slot base',
      engineLabel: 'Motor',
      targetRes: 'Resolución objetivo',
      recommended: 'Recomendado',
      alreadyMax2K: 'La imagen ya es 2K o superior, usa la ampliación 4K',
      alreadyMax4K: 'La imagen ya es 4K, no necesita ampliación',
      upscaleFailed: 'Error al ampliar',
      upscaling: 'Ampliando a {size}...',    },
    presets: {
      title: 'Estilos Predefinidos',
      clearAll: 'Borrar Todo',
      masterStyles: 'Estilos Maestros',
      architecture: [
        { label: 'Tiempo y Atmósfera', tags: ['Amanecer', 'Mediodía', 'Hora Dorada', 'Hora Azul', 'Crepúsculo', 'Noche Profunda'] },
        { label: 'Estilo Arquitectónico', tags: ['Minimalismo', 'Cyberpunk', 'Wabi-sabi', 'Bauhaus', 'Paramétrico', 'Brutalismo'] },
        { label: 'Material', tags: ['Hormigón Visto', 'Vidrio Hueco', 'Madera Natural', 'Granito Flameado', 'Ladrillo Artesanal', 'Revestimiento Acero'] },
        { label: 'Luz y Clima', tags: ['Efecto Tyndall', 'Iluminación Global', 'Contraluz', 'Difusión Suave', 'Nube Volumétrica', 'Niebla Densa'] },
      ],
      product: [
        { label: 'Tipo de Producto', tags: ['Smartphone', 'Reloj de Lujo', 'Mueble Minimal', 'Coche Eléctrico', 'Dron Industrial', 'Silla Ergonómica'] },
        { label: 'Proceso CMF', tags: ['Aluminio Anodizado', 'Fibra de Carbono', 'Acero Cepillado', 'Chorro de Arena', 'Cerámica Brillante', 'Acrílico Transparente'] },
        { label: 'Iluminación Estudio', tags: ['Tres Puntos', 'Luz de Borde', 'Softbox', 'Luz Anular', 'Bokeh', 'Macro'] },
      ],
      art: [
        { label: 'Movimiento Artístico', tags: ['Pop Art', 'Surrealismo', 'Impresionismo', 'Expresionismo Abstracto', 'Vaporwave', 'Glitch Art'] },
        { label: 'Elementos Visuales', tags: ['Tipografía Minimal', 'Contraste Audaz', 'Lunares', 'Geometría Remix', 'Flujo Líquido', 'Textura de Ruido'] },
        { label: 'Medio', tags: ['Serigrafía', 'Pincelada Óleo', 'Ilustración Vectorial', 'Render 3D', 'Tinta Aguada', 'Collage'] },
      ],
      character: [
        { label: 'Arquetipo', tags: ['Samurái Cyber', 'Mago Oscuro', 'Soldado Futuro', 'Piloto Mecha', 'Vagabundo Yermo', 'Caballero Victoriano'] },
        { label: 'Material de Equipo', tags: ['Armadura Dañada', 'Nylon Táctico', 'Músculo Biónico', 'Cuero Envejecido', 'Cables Luminosos', 'Visor Holográfico'] },
        { label: 'Atmósfera', tags: ['Épico Grandioso', 'Composición Cinematográfica', 'Silueta', 'Oscuro Opresivo', 'Luz Sagrada', 'Salpicadura de Sangre'] },
      ],
    },
  },

  'fr-FR': {
    common: {
      confirm: 'Confirmer',
      cancel: 'Annuler',
      save: 'Enregistrer',
      delete: 'Supprimer',
      edit: 'Modifier',
      close: 'Fermer',
      reset: 'Réinitialiser',
      loading: 'Chargement...',
      success: 'Succès',
      error: 'Erreur',
      search: 'Rechercher',
      upload: 'Télécharger',
      download: 'Télécharger',
      copy: 'Copier',
      paste: 'Coller',
      cut: 'Couper',
    },
    main: {
      welcome: 'Bonjour, comment puis-je vous aider?',
      welcomeMessage: 'Bienvenue à Chief Image Architect',
      newChat: 'Nouveau Chat',
      newConversation: 'Nouvelle Conversation',
      settings: 'Paramètres',
      logout: 'Déconnexion',
      profile: 'Profil',
    },
    sidebar: {
      conversations: 'Conversations',
      history: 'Historique',
      favorites: 'Favoris',
      newGroup: 'Nouveau Groupe',
      newSession: 'Nouvelle Session',
      rename: 'Renommer',
      delete: 'Supprimer',
      todayConversations: 'Conversations d\'Aujourd\'hui',
    },
    tabs: {
      chat: 'Chat',
      architect: 'Rendu',
      video: 'Vidéo',
      imageGen: 'Génération d\'Images',
      imageAnalyze: 'Analyse d\'Images',
    },
    domains: {
      architecture: 'Espace Architectural',
      product: 'Design de Produit',
      art: 'Art Visuel',
      character: 'Concept de Personnage',
    },
    settings: {
      title: 'Centre de Contrôle',
      subtitle: 'Command Center',
      tabs: {
        preferences: 'Préférences',
        account: 'Compte',
        subscription: 'Abonnement',
        agreement: 'Accord',
        about: 'À propos',
        system: 'Système',
      },
      preferences: {
        title: 'Préférences d\'Interface',
        subtitle: 'Personnaliser',
        theme: 'Style de Thème',
        themeDesc: 'Choisissez votre thème préféré',
        themePreview: 'Aperçu du Thème',
        themePreviewDesc: 'Cette zone affiche la couleur du thème lorsque vous changez de thème',
        fontSize: 'Taille de Police',
        fontSizeDesc: 'Ajuster la taille du texte',
        fontSizeTip: '💡 Astuce: L\'ajustement de la taille de police affecte tout le texte de l\'interface',
        language: 'Langue',
        languageDesc: 'Sélectionner la langue de l\'interface',
        resetToDefault: 'Réinitialiser par Défaut',
        resetConfirm: 'Êtes-vous sûr de réinitialiser toutes les préférences?',
      },
      themes: {
        dark: 'Sombre',
        light: 'Clair',
        indigo: 'Indigo',
        ocean: 'Océan',
        forest: 'Forêt',
        sunset: 'Coucher de Soleil',
        minimal: 'Minimaliste',
      },
      fontSizes: {
        small: 'Petit',
        medium: 'Moyen',
        large: 'Grand',
      },
    },
    account: {
      title: 'Informations du Compte',
      logout: 'Déconnexion',
      tier: 'Niveau d\'Utilisateur',
      points: 'Solde de Points',
      dailyPoints: 'Points Quotidiens',
      purchasedPoints: 'Points Achetés',
      totalPoints: 'Points Totaux',
      balance: 'Solde Total',
      dailyBalance: 'Solde Quotidien',
      consumed: 'Consommé',
    },
    buttons: {
      themeButton: 'Bouton de Thème',
      borderButton: 'Bouton de Bordure',
      generate: 'Générer',
      regenerate: 'Régénérer',
      send: 'Envoyer',
      clear: 'Effacer',
      export: 'Exporter',
      import: 'Importer',
      stopGenerate: 'Arrêter',
      rerender: 'Régénérer',
      inpaint: 'Modifier Partiellement',
      analyzeImage: 'Analyser l\'Image',
      reversePrompt: 'Prompt Inverse',
      jsonPrompt: 'Prompt JSON',
      thinkingText: 'Réflexion...',
      generatingImage: 'Génération d\'image...',
      generatingVideo: 'Génération de vidéo, veuillez patienter...',
      inpainting: 'Modification partielle...',
      cancelled: 'Annulé',
      videoGenerationFailed: 'Échec de la génération vidéo',
      quantity: 'Quantité',
      stdDownload: 'Télécharger',
      originalDownload: 'Original',
      originalDownloadLocked: 'Original🔒',
      unlockOriginal: 'Passez à PRO/PLUS pour télécharger sans filigrane',
      fullscreen: 'Plein écran',
      inpaintShort: 'Retoucher',
      hdShort: 'HD',
      undo: 'Annuler',
      imageCount: 'Img',
      inpaintConfirm: 'Retoucher l\'image {n}. Confirmer ?',
    },
    parameters: {
      title: 'Configuration des Paramètres',
      aspectRatio: 'Rapport d\'Aspect',
      resolution: 'Résolution',
      engine: 'Moteur',
      count: 'Nombre',
      temperature: 'Température',
      topP: 'Top P',
      seed: 'Graine',
      videoLength: 'Durée de la Vidéo',
      imageSize: 'Taille',
      quality: 'Qualité',
      advanced: 'Avancé',
      custom: 'Personnalisé',
      customPlaceholder: 'ex. 2:3',
      fast: 'Rapide',
      highQuality: 'Haute Qualité',
      lockSeed: 'Fixer la graine',
      unlockSeed: 'Libérer la graine',
      random: 'Aléatoire',
      model: 'Modèle',
      duration: 'Durée',
      cameraMotionTip: '💡 Conseil: Décrivez le mouvement de caméra dans votre prompt, ex. "zoom lent", "panoramique gauche-droite", "orbite"',
      hdUpscale: 'Agrandissement HD',
      inpaintEdit: 'Édition partielle',
      selectUpscaleOption: 'Choisir l\'option d\'agrandissement',
      currentSize: 'Taille actuelle : ',
      upscaleHint: 'L\'image agrandie sera placée dans le premier slot de base',
      engineLabel: 'Moteur',
      targetRes: 'Résolution cible',
      recommended: 'Recommandé',
      alreadyMax2K: 'L\'image est déjà en 2K ou plus, utilisez l\'agrandissement 4K',
      alreadyMax4K: 'L\'image est déjà en 4K, aucun agrandissement nécessaire',
      upscaleFailed: 'Échec de l\'agrandissement',
      upscaling: 'Agrandissement vers {size}...',    },
    presets: {
      title: 'Styles Prédéfinis',
      clearAll: 'Tout Effacer',
      masterStyles: 'Styles Maîtres',
      architecture: [
        { label: 'Temps et Atmosphère', tags: ['Aube', 'Midi', 'Heure Dorée', 'Heure Bleue', 'Crépuscule', 'Nuit Profonde'] },
        { label: 'Style Architectural', tags: ['Minimalisme', 'Cyberpunk', 'Wabi-sabi', 'Bauhaus', 'Paramétrique', 'Brutalisme'] },
        { label: 'Matériau', tags: ['Béton Brut', 'Verre Creux', 'Bois Naturel', 'Granit Flammé', 'Brique Artisanale', 'Revêtement Acier'] },
        { label: 'Lumière et Météo', tags: ['Effet Tyndall', 'Éclairage Global', 'Contre-jour', 'Diffusion Douce', 'Nuage Volumétrique', 'Brouillard Dense'] },
      ],
      product: [
        { label: 'Type de Produit', tags: ['Smartphone', 'Montre de Luxe', 'Mobilier Minimal', 'Voiture Électrique', 'Drone Industriel', 'Chaise Ergonomique'] },
        { label: 'Procédé CMF', tags: ['Aluminium Anodisé', 'Fibre de Carbone', 'Acier Brossé', 'Sablage', 'Céramique Brillante', 'Acrylique Transparent'] },
        { label: 'Éclairage Studio', tags: ['Trois Points', 'Lumière de Contour', 'Softbox', 'Lumière Annulaire', 'Bokeh', 'Macro'] },
      ],
      art: [
        { label: 'Mouvement Artistique', tags: ['Pop Art', 'Surréalisme', 'Impressionnisme', 'Expressionnisme Abstrait', 'Vaporwave', 'Glitch Art'] },
        { label: 'Éléments Visuels', tags: ['Typographie Minimale', 'Contraste Audacieux', 'Pois', 'Géométrie Remix', 'Flux Liquide', 'Texture de Bruit'] },
        { label: 'Médium', tags: ['Sérigraphie', 'Touche Huile', 'Illustration Vectorielle', 'Rendu 3D', 'Lavis Encre', 'Collage'] },
      ],
      character: [
        { label: 'Archétype', tags: ['Samouraï Cyber', 'Mage Sombre', 'Soldat Futur', 'Pilote Mecha', 'Vagabond des Terres', 'Gentleman Victorien'] },
        { label: 'Matériau Équipement', tags: ['Armure Endommagée', 'Nylon Tactique', 'Muscle Bionique', 'Cuir Vieilli', 'Câbles Lumineux', 'Visière Holographique'] },
        { label: 'Atmosphère', tags: ['Épique Grandiose', 'Composition Cinématique', 'Silhouette', 'Sombre Oppressif', 'Lumière Sacrée', 'Éclaboussure de Sang'] },
      ],
    },
  },

  'de-DE': {
    common: {
      confirm: 'Bestätigen',
      cancel: 'Abbrechen',
      save: 'Speichern',
      delete: 'Löschen',
      edit: 'Bearbeiten',
      close: 'Schließen',
      reset: 'Zurücksetzen',
      loading: 'Laden...',
      success: 'Erfolg',
      error: 'Fehler',
      search: 'Suchen',
      upload: 'Hochladen',
      download: 'Herunterladen',
      copy: 'Kopieren',
      paste: 'Einfügen',
      cut: 'Ausschneiden',
    },
    main: {
      welcome: 'Hallo, wie kann ich Ihnen helfen?',
      welcomeMessage: 'Willkommen bei Chief Image Architect',
      newChat: 'Neuer Chat',
      newConversation: 'Neue Konversation',
      settings: 'Einstellungen',
      logout: 'Abmelden',
      profile: 'Profil',
    },
    sidebar: {
      conversations: 'Konversationen',
      history: 'Verlauf',
      favorites: 'Favoriten',
      newGroup: 'Neue Gruppe',
      newSession: 'Neue Sitzung',
      rename: 'Umbenennen',
      delete: 'Löschen',
      todayConversations: 'Heutige Konversationen',
    },
    tabs: {
      chat: 'Chat',
      architect: 'Rendering',
      video: 'Video',
      imageGen: 'Bildgenerierung',
      imageAnalyze: 'Bildanalyse',
    },
    domains: {
      architecture: 'Architekturraum',
      product: 'Produktdesign',
      art: 'Visuelle Kunst',
      character: 'Charakterkonzept',
    },
    settings: {
      title: 'Kontrollzentrum',
      subtitle: 'Command Center',
      tabs: {
        preferences: 'Einstellungen',
        account: 'Konto',
        subscription: 'Abonnement',
        agreement: 'Vereinbarung',
        about: 'Über',
        system: 'System',
      },
      preferences: {
        title: 'Oberflächeneinstellungen',
        subtitle: 'Anpassen',
        theme: 'Themenstil',
        themeDesc: 'Wählen Sie Ihr bevorzugtes Thema',
        themePreview: 'Themenvorschau',
        themePreviewDesc: 'Dieser Bereich zeigt die Themenfarbe, wenn Sie das Thema wechseln',
        fontSize: 'Schriftgröße',
        fontSizeDesc: 'Textgröße anpassen',
        fontSizeTip: '💡 Tipp: Die Anpassung der Schriftgröße wirkt sich auf den gesamten Text der Oberfläche aus',
        language: 'Sprache',
        languageDesc: 'Oberflächensprache auswählen',
        resetToDefault: 'Auf Standard zurücksetzen',
        resetConfirm: 'Möchten Sie alle Einstellungen zurücksetzen?',
      },
      themes: {
        dark: 'Dunkel',
        light: 'Hell',
        indigo: 'Indigo',
        ocean: 'Ozean',
        forest: 'Wald',
        sunset: 'Sonnenuntergang',
        minimal: 'Minimal',
      },
      fontSizes: {
        small: 'Klein',
        medium: 'Mittel',
        large: 'Groß',
      },
    },
    account: {
      title: 'Kontoinformationen',
      logout: 'Abmelden',
      tier: 'Benutzerstufe',
      points: 'Punktestand',
      dailyPoints: 'Tägliche Punkte',
      purchasedPoints: 'Gekaufte Punkte',
      totalPoints: 'Gesamtpunkte',
      balance: 'Gesamtsaldo',
      dailyBalance: 'Tagessaldo',
      consumed: 'Verbraucht',
    },
    buttons: {
      themeButton: 'Themen-Button',
      borderButton: 'Rahmen-Button',
      generate: 'Generieren',
      regenerate: 'Neu generieren',
      send: 'Senden',
      clear: 'Löschen',
      export: 'Exportieren',
      import: 'Importieren',
      stopGenerate: 'Stoppen',
      rerender: 'Neu rendern',
      inpaint: 'Teilweise Ändern',
      analyzeImage: 'Bild Analysieren',
      reversePrompt: 'Prompt Umkehren',
      jsonPrompt: 'JSON Prompt',
      thinkingText: 'Denken...',
      generatingImage: 'Bild wird generiert...',
      generatingVideo: 'Video wird generiert, bitte warten...',
      inpainting: 'Teilweise Änderung...',
      cancelled: 'Abgebrochen',
      videoGenerationFailed: 'Videogenerierung fehlgeschlagen',
      quantity: 'Menge',
      stdDownload: 'Herunterladen',
      originalDownload: 'Original',
      originalDownloadLocked: 'Original🔒',
      unlockOriginal: 'Auf PRO/PLUS upgraden für wasserzeichenfreien Download',
      fullscreen: 'Vollbild',
      inpaintShort: 'Bearbeiten',
      hdShort: 'HD',
      undo: 'Rückgängig',
      imageCount: 'Bild',
      inpaintConfirm: 'Bild {n} teilweise bearbeiten. Bestätigen?',
    },
    parameters: {
      title: 'Parametereinstellungen',
      aspectRatio: 'Seitenverhältnis',
      resolution: 'Auflösung',
      engine: 'Engine',
      count: 'Anzahl',
      temperature: 'Temperatur',
      topP: 'Top P',
      seed: 'Seed',
      videoLength: 'Videolänge',
      imageSize: 'Größe',
      quality: 'Qualität',
      advanced: 'Erweitert',
      custom: 'Benutzerdefiniert',
      customPlaceholder: 'z.B. 2:3',
      fast: 'Schnell',
      highQuality: 'Hohe Qualität',
      lockSeed: 'Seed fixieren',
      unlockSeed: 'Seed freigeben',
      random: 'Zufällig',
      model: 'Modell',
      duration: 'Dauer',
      cameraMotionTip: '💡 Tipp: Beschreiben Sie die Kamerabewegung im Prompt, z.B. "langsames Zoomen", "Schwenk von links nach rechts", "Umlaufbahn"',
      hdUpscale: 'HD-Vergrößerung',
      inpaintEdit: 'Teilbearbeitung',
      selectUpscaleOption: 'Vergrößerungsoption wählen',
      currentSize: 'Aktuelle Größe: ',
      upscaleHint: 'Das vergrößerte Bild wird im ersten Basis-Slot platziert',
      engineLabel: 'Engine',
      targetRes: 'Zielauflösung',
      recommended: 'Empfohlen',
      alreadyMax2K: 'Bild ist bereits 2K oder höher, bitte 4K-Vergrößerung verwenden',
      alreadyMax4K: 'Bild ist bereits 4K, keine Vergrößerung nötig',
      upscaleFailed: 'Vergrößerung fehlgeschlagen',
      upscaling: 'Vergrößerung auf {size}...',    },
    presets: {
      title: 'Stil-Voreinstellungen',
      clearAll: 'Alle Löschen',
      masterStyles: 'Meisterstile',
      architecture: [
        { label: 'Zeit und Atmosphäre', tags: ['Morgendämmerung', 'Mittag', 'Goldene Stunde', 'Blaue Stunde', 'Dämmerung', 'Tiefe Nacht'] },
        { label: 'Architekturstil', tags: ['Minimalismus', 'Cyberpunk', 'Wabi-sabi', 'Bauhaus', 'Parametrisch', 'Brutalismus'] },
        { label: 'Material', tags: ['Sichtbeton', 'Hohlglas', 'Rohholz', 'Geflammter Granit', 'Handgefertigter Ziegel', 'Stahlverkleidung'] },
        { label: 'Licht und Wetter', tags: ['Tyndall-Effekt', 'Globale Beleuchtung', 'Gegenlicht', 'Weiche Streuung', 'Volumetrische Wolke', 'Dichter Nebel'] },
      ],
      product: [
        { label: 'Produkttyp', tags: ['Smartphone', 'Luxusuhr', 'Minimalmöbel', 'Elektroauto', 'Industriedrohne', 'Ergonomischer Stuhl'] },
        { label: 'CMF-Verfahren', tags: ['Eloxiertes Aluminium', 'Kohlefaser', 'Gebürsteter Stahl', 'Sandgestrahlt', 'Glänzende Keramik', 'Transparentes Acryl'] },
        { label: 'Studiobeleuchtung', tags: ['Drei-Punkt-Licht', 'Randlicht', 'Softbox', 'Ringlicht', 'Bokeh', 'Makro-Nahaufnahme'] },
      ],
      art: [
        { label: 'Kunstbewegung', tags: ['Pop Art', 'Surrealismus', 'Impressionismus', 'Abstrakter Expressionismus', 'Vaporwave', 'Glitch Art'] },
        { label: 'Visuelle Elemente', tags: ['Minimale Typografie', 'Kühner Kontrast', 'Polka Dots', 'Geometrisches Remix', 'Flüssiger Fluss', 'Rauschtextur'] },
        { label: 'Medium', tags: ['Siebdruck', 'Ölpinselstrich', 'Vektorillustration', '3D-Rendering', 'Tuschmalerei', 'Collage'] },
      ],
      character: [
        { label: 'Archetyp', tags: ['Cyber-Samurai', 'Dunkler Magier', 'Zukunftssoldat', 'Mech-Pilot', 'Ödland-Wanderer', 'Viktorianischer Gentleman'] },
        { label: 'Ausrüstungsmaterial', tags: ['Kampfbeschädigte Rüstung', 'Taktisches Nylon', 'Bionischer Muskel', 'Gealtertes Leder', 'Leuchtende Kabel', 'Holografisches Visier'] },
        { label: 'Atmosphäre', tags: ['Episch Grandios', 'Filmische Komposition', 'Silhouette', 'Dunkel Bedrückend', 'Heiliges Licht', 'Blutspritzer'] },
      ],
    },
  },

  'ru-RU': {
    common: {
      confirm: 'Подтвердить',
      cancel: 'Отмена',
      save: 'Сохранить',
      delete: 'Удалить',
      edit: 'Редактировать',
      close: 'Закрыть',
      reset: 'Сбросить',
      loading: 'Загрузка...',
      success: 'Успех',
      error: 'Ошибка',
      search: 'Поиск',
      upload: 'Загрузить',
      download: 'Скачать',
      copy: 'Копировать',
      paste: 'Вставить',
      cut: 'Вырезать',
    },
    main: {
      welcome: 'Здравствуйте, чем могу помочь?',
      welcomeMessage: 'Добро пожаловать в Chief Image Architect',
      newChat: 'Новый Чат',
      newConversation: 'Новая Беседа',
      settings: 'Настройки',
      logout: 'Выйти',
      profile: 'Профиль',
    },
    sidebar: {
      conversations: 'Беседы',
      history: 'История',
      favorites: 'Избранное',
      newGroup: 'Новая Группа',
      newSession: 'Новая Сессия',
      rename: 'Переименовать',
      delete: 'Удалить',
      todayConversations: 'Сегодняшние Беседы',
    },
    tabs: {
      chat: 'Чат',
      architect: 'Рендеринг',
      video: 'Видео',
      imageGen: 'Генерация Изображений',
      imageAnalyze: 'Анализ Изображений',
    },
    domains: {
      architecture: 'Архитектурное Пространство',
      product: 'Дизайн Продукта',
      art: 'Визуальное Искусство',
      character: 'Концепт Персонажа',
    },
    settings: {
      title: 'Центр Управления',
      subtitle: 'Command Center',
      tabs: {
        preferences: 'Настройки',
        account: 'Аккаунт',
        subscription: 'Подписка',
        agreement: 'Соглашение',
        about: 'О программе',
        system: 'Система',
      },
      preferences: {
        title: 'Настройки Интерфейса',
        subtitle: 'Персонализация',
        theme: 'Стиль Темы',
        themeDesc: 'Выберите предпочитаемую тему',
        themePreview: 'Предпросмотр Темы',
        themePreviewDesc: 'Эта область показывает цвет темы при переключении тем',
        fontSize: 'Размер Шрифта',
        fontSizeDesc: 'Настроить размер текста',
        fontSizeTip: '💡 Совет: Настройка размера шрифта влияет на весь текст интерфейса',
        language: 'Язык',
        languageDesc: 'Выбрать язык интерфейса',
        resetToDefault: 'Сбросить по Умолчанию',
        resetConfirm: 'Вы уверены, что хотите сбросить все настройки?',
      },
      themes: {
        dark: 'Темная',
        light: 'Светлая',
        indigo: 'Индиго',
        ocean: 'Океан',
        forest: 'Лес',
        sunset: 'Закат',
        minimal: 'Минимал',
      },
      fontSizes: {
        small: 'Маленький',
        medium: 'Средний',
        large: 'Большой',
      },
    },
    account: {
      title: 'Информация об Аккаунте',
      logout: 'Выйти',
      tier: 'Уровень Пользователя',
      points: 'Баланс Очков',
      dailyPoints: 'Ежедневные Очки',
      purchasedPoints: 'Купленные Очки',
      totalPoints: 'Всего Очков',
      balance: 'Общий Баланс',
      dailyBalance: 'Дневной Баланс',
      consumed: 'Потрачено',
    },
    buttons: {
      themeButton: 'Кнопка Темы',
      borderButton: 'Кнопка с Рамкой',
      generate: 'Генерировать',
      regenerate: 'Перегенерировать',
      send: 'Отправить',
      clear: 'Очистить',
      export: 'Экспорт',
      import: 'Импорт',
      stopGenerate: 'Остановить',
      rerender: 'Перерендерить',
      inpaint: 'Частичное Изменение',
      analyzeImage: 'Анализ Изображения',
      reversePrompt: 'Обратный Промпт',
      jsonPrompt: 'JSON Промпт',
      thinkingText: 'Думаю...',
      generatingImage: 'Генерация изображения...',
      generatingVideo: 'Генерация видео, пожалуйста подождите...',
      inpainting: 'Частичное изменение...',
      cancelled: 'Отменено',
      videoGenerationFailed: 'Генерация видео не удалась',
      quantity: 'Количество',
      stdDownload: 'Скачать',
      originalDownload: 'Оригинал',
      originalDownloadLocked: 'Оригинал🔒',
      unlockOriginal: 'Обновитесь до PRO/PLUS для скачивания без водяного знака',
      fullscreen: 'Полный экран',
      inpaintShort: 'Ретушь',
      hdShort: 'HD',
      undo: 'Отменить',
      imageCount: 'Изобр',
      inpaintConfirm: 'Ретушировать изображение {n}. Подтвердить?',
    },
    parameters: {
      title: 'Настройки Параметров',
      aspectRatio: 'Соотношение Сторон',
      resolution: 'Разрешение',
      engine: 'Движок',
      count: 'Количество',
      temperature: 'Температура',
      topP: 'Top P',
      seed: 'Сид',
      videoLength: 'Длина Видео',
      imageSize: 'Размер',
      quality: 'Качество',
      advanced: 'Расширенные',
      custom: 'Пользовательский',
      customPlaceholder: 'напр. 2:3',
      fast: 'Быстро',
      highQuality: 'Высокое Качество',
      lockSeed: 'Зафиксировать сид',
      unlockSeed: 'Разблокировать сид',
      random: 'Случайный',
      model: 'Модель',
      duration: 'Длительность',
      cameraMotionTip: '💡 Совет: Опишите движение камеры в промпте, напр. "медленное приближение", "панорама слева направо", "орбита"',
      hdUpscale: 'HD увеличение',
      inpaintEdit: 'Частичное редактирование',
      selectUpscaleOption: 'Выберите вариант увеличения',
      currentSize: 'Текущий размер: ',
      upscaleHint: 'Увеличенное изображение будет помещено в первый базовый слот',
      engineLabel: 'Движок',
      targetRes: 'Целевое разрешение',
      recommended: 'Рекомендуется',
      alreadyMax2K: 'Изображение уже 2K или выше, используйте увеличение до 4K',
      alreadyMax4K: 'Изображение уже 4K, увеличение не требуется',
      upscaleFailed: 'Ошибка увеличения',
      upscaling: 'Увеличение до {size}...',    },
    presets: {
      title: 'Стили Пресетов',
      clearAll: 'Очистить Всё',
      masterStyles: 'Стили Мастеров',
      architecture: [
        { label: 'Время и Атмосфера', tags: ['Рассвет', 'Полдень', 'Золотой Час', 'Синий Час', 'Сумерки', 'Глубокая Ночь'] },
        { label: 'Архитектурный Стиль', tags: ['Минимализм', 'Киберпанк', 'Ваби-саби', 'Баухаус', 'Параметрический', 'Брутализм'] },
        { label: 'Материал', tags: ['Открытый Бетон', 'Полый Стекло', 'Необработанное Дерево', 'Пламенный Гранит', 'Ручной Кирпич', 'Стальная Обшивка'] },
        { label: 'Свет и Погода', tags: ['Эффект Тиндаля', 'Глобальное Освещение', 'Контровой Свет', 'Мягкое Рассеивание', 'Объёмное Облако', 'Густой Туман'] },
      ],
      product: [
        { label: 'Тип Продукта', tags: ['Смартфон', 'Люксовые Часы', 'Минимальная Мебель', 'Электромобиль', 'Промышленный Дрон', 'Эргономичное Кресло'] },
        { label: 'Процесс CMF', tags: ['Анодированный Алюминий', 'Углеродное Волокно', 'Шлифованная Сталь', 'Пескоструйная Обработка', 'Глянцевая Керамика', 'Прозрачный Акрил'] },
        { label: 'Студийное Освещение', tags: ['Трёхточечный Свет', 'Контурный Свет', 'Софтбокс', 'Кольцевой Свет', 'Боке', 'Макро Крупный План'] },
      ],
      art: [
        { label: 'Художественное Движение', tags: ['Поп-арт', 'Сюрреализм', 'Импрессионизм', 'Абстрактный Экспрессионизм', 'Вейпорвейв', 'Глитч-арт'] },
        { label: 'Визуальные Элементы', tags: ['Минимальная Типографика', 'Смелый Контраст', 'Горошек', 'Геометрический Ремикс', 'Жидкий Поток', 'Шумовая Текстура'] },
        { label: 'Медиум', tags: ['Шелкография', 'Мазок Маслом', 'Векторная Иллюстрация', '3D Рендер', 'Тушь', 'Коллаж'] },
      ],
      character: [
        { label: 'Архетип', tags: ['Кибер-самурай', 'Тёмный Маг', 'Солдат Будущего', 'Пилот Меха', 'Странник Пустоши', 'Викторианский Джентльмен'] },
        { label: 'Материал Снаряжения', tags: ['Повреждённая Броня', 'Тактический Нейлон', 'Бионическая Мышца', 'Состаренная Кожа', 'Светящиеся Провода', 'Голографический Визор'] },
        { label: 'Атмосфера', tags: ['Эпический Масштаб', 'Кинематографическая Композиция', 'Силуэт', 'Тёмное Угнетение', 'Священный Свет', 'Брызги Крови'] },
      ],
    },
  },
};

// 获取翻译文本的辅助函数
export function getTranslation(lang: Language): Translations {
  return translations[lang] || translations['zh-CN'];
}
