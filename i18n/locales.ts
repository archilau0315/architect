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
    },
  },
};

// 获取翻译文本的辅助函数
export function getTranslation(lang: Language): Translations {
  return translations[lang] || translations['zh-CN'];
}
