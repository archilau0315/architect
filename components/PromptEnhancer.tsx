
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { GeminiService, EnhancedPrompt, DEFAULT_SYSTEM_PRESETS, MASTER_STYLES } from '../services/geminiService.ts';
import { CustomModel, CreativeDomain } from '../types.ts';

interface PromptEnhancerProps {
  idea: string;
  onIdeaChange: (val: string) => void;
  result: EnhancedPrompt;
  onResultChange: (enhanced: EnhancedPrompt) => void;
  instructions?: typeof DEFAULT_SYSTEM_PRESETS;
  fontSize?: number;
  modelConfig: CustomModel;
  onBusyStateChange?: (busy: boolean) => void;
  domain: CreativeDomain;
  usePromptEnhance: boolean;
  onTogglePromptEnhance: (enabled: boolean) => void;
}

const DOMAIN_TAGS: Record<CreativeDomain, any[]> = {
  architecture: [
    { label: '大师风格', subLabel: 'Masters', tags: MASTER_STYLES.filter(m => m.domain === 'architecture').map(m => m.name) },
    { label: '时段环境', subLabel: 'Time', tags: ['晨曦 Dawn', '正午 Noon', '黄金时刻 Golden Hour', '蓝调时刻 Blue Hour', '暮色 Dusk', '深夜 Deep Night', '极光 Aurora', '暴雨前夕 Stormy'] },
    { label: '季节气候', subLabel: 'Season', tags: ['繁花春意 Spring', '绿意盛夏 Summer', '晚秋凋零 Autumn', '皑皑凛冬 Winter', '梅雨季节 Rainy', '沙尘氛围 Dusty', '薄雾弥漫 Mist'] },
    { label: '建筑风格', subLabel: 'Arch Styles', tags: ['极简主义 Minimalism', '赛博朋克 Cyberpunk', '侘寂 Wabi-sabi', '包豪斯 Bauhaus', '参数化主义 Parametric', '现代主义 Modernism', '野兽主义 Brutalism', '解构主义 Deconstructivism', '古典复兴 Classical'] },
    { label: '材质纹理', subLabel: 'Materials', tags: ['清水混凝土', '中空玻璃', '原木质感', '烧毛面花岗岩', '手工黏土砖', '超纤皮革', '碳纤维', 'ETFE 气膜', '不锈钢蒙皮', '夯土墙面'] },
    { label: '气象光影', subLabel: 'Light', tags: ['丁达尔效应', '全局光照', '逆光 Cinematic', '柔和扩散', '体积云', '大雾 Dense Fog', '漫反射 Ambient', '边缘勾勒 Rim Light'] }
  ],
  product: [
    { label: '大师风格', subLabel: 'Masters', tags: MASTER_STYLES.filter(m => m.domain === 'product').map(m => m.name) },
    { label: '产品分类', subLabel: 'Types', tags: ['智能手机', '高端腕表', '极简家具', '电动汽车', '工业无人机', '人体工学椅', 'Hi-Fi 音响', '医疗器械', '智能头显'] },
    { label: 'CMF 工艺', subLabel: 'Process', tags: ['阳极氧化铝', '碳纤维纹理', '拉丝不锈钢', '喷砂工艺', '高光陶瓷', '透明亚克力', '软涂层橡胶', '液态硅胶', 'PVD 镀膜', '真皮包覆'] },
    { label: '影棚灯光', subLabel: 'Studio', tags: ['三点布光', '边缘勾勒光', '柔光箱', '顶部环形灯', '焦外虚化', '微距特写', '高调纯白背景', '悬浮构图', '硬调阴影', '动态运动模糊'] }
  ],
  art: [
    { label: '大师风格', subLabel: 'Masters', tags: MASTER_STYLES.filter(m => m.domain === 'art').map(m => m.name) },
    { label: '艺术流派', subLabel: 'Movements', tags: ['波普艺术 Pop Art', '超现实主义', '印象派', '抽象表现主义', '蒸汽波 Vaporwave', '故障艺术 Glitch', 'Ukiyo-e 浮世绘', '新现实主义', '立体主义 Cubism'] },
    { label: '视觉要素', subLabel: 'Elements', tags: ['极简排版', '大胆对比色', '波尔卡圆点', '几何重组', '液体流动感', '噪点肌理', '双重曝光', '霓虹眩光', '错视艺术 Op-Art', '分形几何'] },
    { label: '表现媒介', subLabel: 'Media', tags: ['丝网印刷', '油画笔触', '矢量插画', '3D 渲染', '水墨晕染', '拼贴艺术', '涂鸦喷绘', '电影海报感', '炭笔素描', '数字雕塑'] }
  ],
  character: [
    { label: '大师风格', subLabel: 'Masters', tags: MASTER_STYLES.filter(m => m.domain === 'character').map(m => m.name) },
    { label: '角色原型', subLabel: 'Archetypes', tags: ['赛博武士', '暗黑巫师', '未来士兵', '机甲驾驶员', '荒原流浪者', '维多利亚绅士', '外星生物', '仿生人', '神话英灵', '隐世忍者'] },
    { label: '装备材质', subLabel: 'Gear', tags: ['战损盔甲', '战术尼龙', '仿生肌肉', '做旧皮革', '发光排线', '全息目镜', '龙鳞纹理', '重型机械肢', '丝绸披风', '外骨架结构'] },
    { label: '氛围呈现', subLabel: 'Mood', tags: ['史诗级宏大', '电影级构图', '剪影表现', '暗黑压抑', '圣洁之光', '鲜血溅射', '颗粒胶片感', '特写表情', '慢动作冻结', '烟雾弥漫'] }
  ]
};

const COMMON_TAGS = [
  { label: '镜头参数', subLabel: 'Lens', tags: ['God\'s View', 'Eye Level', 'Wide Angle', 'Tilt-Shift', 'Bokeh', 'Macro', 'Anamorphic'] },
  { label: '成片质感', subLabel: 'Quality', tags: ['V-Ray', 'Octane', 'UE5', '8K Realism', 'Kodak Film', 'Concept Sketch', 'PBR Material'] }
];

const PromptEnhancer: React.FC<PromptEnhancerProps> = ({ idea, onIdeaChange, result, onResultChange, instructions, fontSize = 18, modelConfig, onBusyStateChange, domain, usePromptEnhance, onTogglePromptEnhance }) => {
  const categories = useMemo(() => [...DOMAIN_TAGS[domain], ...COMMON_TAGS], [domain]);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [activeCategory, setActiveCategory] = useState(categories[0].label);
  const editorRef = useRef<HTMLDivElement>(null);
  const pendingRangeRef = useRef<Range | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastRequestRef = useRef<string>('');
  const isInternalChange = useRef(false);

  // 确保切换领域后 activeCategory 依然有效
  useEffect(() => {
    setActiveCategory(categories[0].label);
  }, [domain, categories]);

  const renderFormattedContent = (text: string) => {
    if (!text) return "";
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const content = part.slice(2, -2);
        return `<span class="weighted-block" contenteditable="false"><span class="weight-marker">**</span>${content}<span class="weight-marker">**</span></span>`;
      }
      return part.replace(/\n/g, '<br/>');
    }).join('');
  };

  const normalizeText = (t: string | null | undefined) => (t || "").replace(/[\u200b\n\r\t]/g, "").trim();

  useEffect(() => {
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    if (editorRef.current) {
      const domText = editorRef.current.textContent || "";
      if (normalizeText(domText) !== normalizeText(idea)) {
        editorRef.current.innerHTML = renderFormattedContent(idea);
      }
    }
  }, [idea]);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const newIdea = e.currentTarget.textContent || "";
    if (normalizeText(newIdea) !== normalizeText(idea)) {
      isInternalChange.current = true;
      onIdeaChange(newIdea);
    }
  };

  const handleEnhance = async () => {
    if (isEnhancing) {
      abortControllerRef.current?.abort();
      setIsEnhancing(false);
      onBusyStateChange?.(false);
      return;
    }
    if (!idea.trim()) return;

    // Cache logic: if the idea is the same as the last successful request, skip
    if (idea.trim() === lastRequestRef.current) {
      return;
    }

    if (!usePromptEnhance) {
      // Skip AI enhancement and return raw input as enhanced prompt
      onResultChange({
        zh: idea,
        en: idea, // In a real scenario, we might want a simple translation here, but for minimum tokens, we just pass through
        analysis: "AI 增强已关闭，直接使用原始指令。"
      });
      return;
    }

    setIsEnhancing(true);
    onBusyStateChange?.(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      const enhanced = await GeminiService.enhancePrompt(idea, domain, instructions, modelConfig, controller.signal);
      onResultChange(enhanced);
      lastRequestRef.current = idea.trim();
    } catch (err: any) { 
      if (err.name !== 'AbortError') alert(`增强失败: ${err.message}`);
    } finally { 
      setIsEnhancing(false);
      onBusyStateChange?.(false);
    }
  };

  const handleClear = () => {
    onIdeaChange('');
    onResultChange({ zh: '', en: '', analysis: '' });
    if (editorRef.current) editorRef.current.innerHTML = "";
    pendingRangeRef.current = null;
  };

  const addTag = (tag: string) => {
    const trimmed = idea.trim();
    const tagClean = tag.split(' ')[0];
    if (trimmed.includes(tagClean)) return;
    const separator = trimmed ? (/[，,]$/.test(trimmed) ? ' ' : '，') : '';
    const newIdea = trimmed + separator + tagClean;
    onIdeaChange(newIdea);
  };

  const themeColor = domain === 'architecture' ? 'indigo' : domain === 'product' ? 'slate' : domain === 'art' ? 'amber' : 'rose';

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6">
        <div className="relative group">
          <div className="absolute top-4 right-8 flex items-center gap-3 z-10 opacity-40 group-hover:opacity-100 transition-all">
             <button onClick={handleClear} className="w-10 h-10 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-rose-500 rounded-full flex items-center justify-center transition-all border border-slate-200 dark:border-slate-700 shadow-sm"><svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg></button>
          </div>
          <div
            ref={editorRef}
            contentEditable
            onInput={handleInput}
            onMouseUp={(e) => {
              const selection = window.getSelection();
              if (selection && !selection.isCollapsed) pendingRangeRef.current = selection.getRangeAt(0).cloneRange();
              else pendingRangeRef.current = null;
            }}
            onContextMenu={(e) => {
              const target = e.target as HTMLElement;
              const block = target.closest('.weighted-block');
              if (block && editorRef.current) {
                e.preventDefault();
                const content = block.textContent?.replace(/\*\*/g, '') || '';
                block.replaceWith(document.createTextNode(content));
                onIdeaChange(editorRef.current.textContent || "");
                return;
              }
              if (pendingRangeRef.current && editorRef.current) {
                e.preventDefault();
                const range = pendingRangeRef.current;
                const selectedText = range.toString().trim();
                if (selectedText) {
                  const htmlSnippet = `<span class="weighted-block" contenteditable="false"><span class="weight-marker">**</span>${selectedText}<span class="weight-marker">**</span></span>`;
                  range.deleteContents();
                  const fragment = range.createContextualFragment(htmlSnippet);
                  range.insertNode(fragment);
                  onIdeaChange(editorRef.current.textContent || "");
                  window.getSelection()?.removeAllRanges();
                  pendingRangeRef.current = null;
                }
              }
            }}
            style={{ fontSize: `${fontSize}px` }}
            className={`w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-[2rem] px-8 py-8 text-slate-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-${themeColor}-500/10 min-h-[160px] shadow-xl transition-all font-medium leading-relaxed overflow-y-auto`}
          />
          {!idea && (
            <div className="absolute top-8 left-8 text-slate-400 pointer-events-none italic opacity-50" style={{ fontSize: `${fontSize}px` }}>
              描述您的创意意图...
            </div>
          )}
        </div>

        <div className="bg-slate-50/50 dark:bg-slate-900/40 rounded-[2.5rem] border border-slate-200 dark:border-slate-800/50 overflow-hidden flex flex-col">
          <div className="flex items-center gap-2 px-8 pt-8 pb-3 overflow-x-auto no-scrollbar">
            {categories.map(cat => (
              <button key={cat.label} onClick={() => setActiveCategory(cat.label)} className={`px-5 py-3 rounded-full transition-all flex flex-col items-center min-w-[120px] ${activeCategory === cat.label ? `bg-${themeColor}-600 text-white shadow-lg` : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800'}`}>
                <span className="text-[13px] font-black">{cat.label}</span>
                <span className="text-[9px] font-bold opacity-60 uppercase">{cat.subLabel}</span>
              </button>
            ))}
          </div>
          <div className="p-8 flex flex-wrap gap-2.5 min-h-[180px] content-start">
            {categories.find(c => c.label === activeCategory)?.tags.map(tag => (
              <button key={tag} onClick={() => addTag(tag)} className={`px-5 py-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl text-[12px] font-bold transition-all hover:border-${themeColor}-500 hover:shadow-md active:scale-95`}>{tag}</button>
            ))}
          </div>
          <div className="px-8 pb-8 pt-2 flex justify-end items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-black italic text-slate-500 dark:text-slate-400 uppercase tracking-tighter">AI 创意增强</span>
                <span className={`text-[8px] font-bold uppercase tracking-[0.2em] ${usePromptEnhance ? 'text-emerald-500' : 'text-slate-400 opacity-60'}`}>
                  {usePromptEnhance ? 'High-Cost Mode' : 'Direct Mode'}
                </span>
              </div>
              <button 
                onClick={() => onTogglePromptEnhance(!usePromptEnhance)}
                className={`w-10 h-5 rounded-full transition-all duration-500 relative active:scale-95 ${usePromptEnhance ? 'bg-emerald-500/80 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-slate-200 dark:bg-slate-800'}`}
              >
                <div 
                  className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-500 ease-in-out pointer-events-none"
                  style={{ transform: usePromptEnhance ? 'translateX(20px)' : 'translateX(0)' }}
                />
              </button>
            </div>
            <button 
              onClick={handleEnhance} 
              disabled={!usePromptEnhance || isEnhancing}
              className={`px-12 py-4 rounded-2xl font-black text-[12px] uppercase tracking-[0.2em] shadow-xl transition-all flex items-center gap-3 ${
                !usePromptEnhance 
                  ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed shadow-none' 
                  : `bg-${themeColor}-600 text-white hover:bg-${themeColor}-500`
              }`}
            >
              {isEnhancing ? "指令解算中..." : 'AI 创意意图增强'}
            </button>
          </div>
        </div>
      </div>

      {(result.zh || result.en || result.analysis) && (
        <div className="space-y-6 animate-in slide-in-from-top-4 duration-700">
          {result.analysis && (
            <div className="p-6 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-[2rem] relative overflow-hidden">
              <div className={`absolute top-0 left-0 w-1 h-full bg-${themeColor}-500`} />
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">创意审计报告</h4>
              <div className="text-[13px] text-slate-600 dark:text-slate-300 italic leading-relaxed">
                {typeof result.analysis === 'string' ? (
                  result.analysis
                ) : (
                  <div className="space-y-2 not-italic">
                    {Object.entries(result.analysis || {}).map(([key, val]) => (
                      <div key={key} className="flex gap-2">
                        <span className="font-black uppercase text-[9px] opacity-50 whitespace-nowrap">[{key}]</span>
                        <span className="text-slate-500 dark:text-slate-400">{String(val)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          {result.zh && (
            <div className="p-6 bg-white/30 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800/50 rounded-[2rem]">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">增强意图描述 (ZH)</h4>
              <p className="text-[13px] text-slate-700 dark:text-slate-200 leading-relaxed font-medium">{result.zh}</p>
            </div>
          )}
          {result.en && (
            <div className={`p-8 bg-${themeColor}-500/5 border border-${themeColor}-500/10 rounded-[2.5rem] glass-card`}>
              <div className="flex justify-between items-center mb-4 px-2">
                <span className={`text-[10px] font-black text-${themeColor}-500 uppercase`}>高端渲染指令 (EN) - 领域对位激活</span>
                <button onClick={() => navigator.clipboard.writeText(result.en)} className="text-[10px] font-bold text-slate-400 hover:text-theme transition-colors uppercase tracking-widest">复制原始指令</button>
              </div>
              <div 
                className={`w-full bg-white dark:bg-slate-950 border border-${themeColor}-500/20 rounded-2xl p-6 text-xs font-mono text-${themeColor}-900 dark:text-${themeColor}-100 min-h-[120px] focus:outline-none overflow-y-auto leading-relaxed custom-scrollbar`}
                dangerouslySetInnerHTML={{ __html: renderFormattedContent(result.en) }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PromptEnhancer;
