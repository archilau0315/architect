
import React, { useState, useRef, useEffect } from 'react';
import { GeminiService, EnhancedPrompt, DEFAULT_SYSTEM_PRESETS } from '../services/geminiService.ts';
import { CustomModel } from '../types.ts';
import { Ph8UsageService } from '../services/ph8UsageService.ts';

interface ImageAnalyzerProps {
  onImportToArchitect: (prompt: EnhancedPrompt) => void;
  instructions?: typeof DEFAULT_SYSTEM_PRESETS;
  onReset?: () => void;
  modelConfig: CustomModel;
  onBusyStateChange?: (busy: boolean) => void;
  points?: { daily: number; purchased: number };
  onConsumePoints?: (amount: number) => boolean;
}

const ANALYZER_STORAGE_KEY = 'ARCHITECT_ANALYZER_WORKBENCH_V1';

const ImageAnalyzer: React.FC<ImageAnalyzerProps> = ({ onImportToArchitect, instructions, onReset, modelConfig, onBusyStateChange, points, onConsumePoints }) => {
  // Token 到积分的换算比例：1 积分 = 150 token
  const TOKENS_PER_POINT = 150;
  const [image, setImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [reversePrompt, setReversePrompt] = useState<EnhancedPrompt | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [prompt, setPrompt] = useState('请详细分析此图像。重点分析其光影布局、材质纹理和构图方式，以便我能复刻类似的艺术风格。');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const analyzeAbortRef = useRef<AbortController | null>(null);
  const extractAbortRef = useRef<AbortController | null>(null);

  // 初始化恢复数据
  useEffect(() => {
    const saved = localStorage.getItem(ANALYZER_STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setImage(data.image || null);
        setAnalysis(data.analysis || null);
        setReversePrompt(data.reversePrompt || null);
      } catch (e) { console.error("Restore analyzer failed", e); }
    }
  }, []);

  // 状态实时持久化
  useEffect(() => {
    const data = { image, analysis, reversePrompt };
    localStorage.setItem(ANALYZER_STORAGE_KEY, JSON.stringify(data));
  }, [image, analysis, reversePrompt]);

  const renderFormattedContent = (text: string) => {
    if (!text) return "";
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const content = part.slice(2, -2);
        return `<span class="weighted-block"><span class="weight-marker">**</span>${content}<span class="weight-marker">**</span></span>`;
      }
      return part.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');
    }).join('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        let result = reader.result as string;
        try {
          result = await GeminiService.compressImage(result);
        } catch (err) { console.warn("Analyzer image compression skipped", err); }
        setImage(result);
        setAnalysis(null);
        setReversePrompt(null);
      };
      reader.readAsDataURL(file as Blob);
    }
  };

  // 计算图片分析成本
  const calculateAnalyzeCost = () => {
    // 图片分析约消耗 3000-5000 token
    const tokens = 4000;
    return Math.ceil(tokens / TOKENS_PER_POINT); // 约 27 积分
  };

  const handleAnalyze = async () => {
    if (isAnalyzing) {
      analyzeAbortRef.current?.abort();
      setIsAnalyzing(false);
      onBusyStateChange?.(false);
      return;
    }

    if (!image) return;

    // 扣除积分
    const cost = calculateAnalyzeCost();
    if (onConsumePoints && !onConsumePoints(cost)) {
      window.alert("积分余额不足。请在管控中心充值或升级订阅。");
      return;
    }

    setIsAnalyzing(true);
    onBusyStateChange?.(true);

    const controller = new AbortController();
    analyzeAbortRef.current = controller;

    try {
      const result = await GeminiService.analyzeImage(image, prompt, instructions, modelConfig, controller.signal);
      setAnalysis(result);

      // 记录实际Token消耗到后端
      const actualTokens = 4000; // 图片分析实际消耗约4000 token
      let userId = 'guest';
      try {
        const sessionData = localStorage.getItem('architect-invite-session');
        if (sessionData) {
          const parsed = JSON.parse(sessionData);
          userId = parsed.userId || parsed.email || 'guest';
        }
      } catch (e) {
        console.error('获取用户ID失败:', e);
      }
      await Ph8UsageService.recordUsage(
        userId,
        { total: actualTokens },
        modelConfig.modelId,
        'image_analysis'
      );
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log("Analysis cancelled by user.");
      } else {
        setAnalysis(`异常错误: ${err.message}`);
      }
    } finally {
      setIsAnalyzing(false);
      onBusyStateChange?.(false);
    }
  };

  // 计算提取渲染指令成本
  const calculateExtractCost = () => {
    // 提取渲染指令约消耗 5000-8000 token（需要生成中英文双版本）
    const tokens = 6500;
    return Math.ceil(tokens / TOKENS_PER_POINT); // 约 44 积分
  };

  const handleExtractPrompt = async () => {
    if (isExtracting) {
      extractAbortRef.current?.abort();
      setIsExtracting(false);
      onBusyStateChange?.(false);
      return;
    }

    if (!image) return;

    // 扣除积分
    const cost = calculateExtractCost();
    if (onConsumePoints && !onConsumePoints(cost)) {
      window.alert("积分余额不足。请在管控中心充值或升级订阅。");
      return;
    }

    setIsExtracting(true);
    onBusyStateChange?.(true);

    const controller = new AbortController();
    extractAbortRef.current = controller;

    try {
      const result = await GeminiService.generateReversePrompt(image, instructions, modelConfig, controller.signal);
      setReversePrompt(result);

      // 记录实际Token消耗到后端
      const actualTokens = 6500; // 提取指令实际消耗约6500 token
      let userId = 'guest';
      try {
        const sessionData = localStorage.getItem('architect-invite-session');
        if (sessionData) {
          const parsed = JSON.parse(sessionData);
          userId = parsed.userId || parsed.email || 'guest';
        }
      } catch (e) {
        console.error('获取用户ID失败:', e);
      }
      await Ph8UsageService.recordUsage(
        userId,
        { total: actualTokens },
        modelConfig.modelId,
        'reverse_prompt'
      );
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log("Extraction cancelled by user.");
      } else {
        console.error(err);
      }
    } finally {
      setIsExtracting(false);
      onBusyStateChange?.(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleLocalReset = () => {
    if (window.confirm("【视觉基因解构 - 重置确认】\n\n确定要清空当前的解构台吗？\n\n这将物理销毁所有已上传图像、生成的图像及待导入指令。")) {
      localStorage.removeItem(ANALYZER_STORAGE_KEY);
      setImage(null);
      setAnalysis(null);
      setReversePrompt(null);
      onReset?.();
    }
  };

  return (
    <div className="w-full h-full space-y-12 animate-in fade-in duration-700">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-8">
        <div className="space-y-1">
          <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight italic">视觉基因解构 <span className="text-theme font-normal tracking-normal">Visual Decryption</span></h3>
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.3em] leading-none">Decode visual logic and reverse-engineer prompts</p>
        </div>
        <button 
          onClick={handleLocalReset}
          className="px-8 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:text-rose-500 hover:border-rose-500/30 transition-all flex items-center gap-3 shadow-sm active:scale-95"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          重置解析台
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 w-full">
        <div className="space-y-8">
          <div onClick={() => fileInputRef.current?.click()} className="aspect-video w-full rounded-[3rem] border-2 border-dashed border-slate-300 dark:border-slate-800 bg-white/60 dark:bg-slate-900/30 flex flex-col items-center justify-center cursor-pointer overflow-hidden relative shadow-2xl transition-all hover:border-theme/50 group">
            {image ? (
              <>
                <img src={image} alt="Preview" className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-105" />
                <button 
                  onClick={(e) => { e.stopPropagation(); setImage(null); setAnalysis(null); setReversePrompt(null); }}
                  className="absolute top-3 right-3 w-8 h-8 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center transition-all z-10 opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95"
                  title="清空图片"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </>
            ) : (
              <div className="text-center p-12 opacity-30 group-hover:opacity-60 transition-opacity">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 mx-auto mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 00-2 2z" strokeWidth={1.5} /></svg>
                <span className="text-sm font-black uppercase tracking-widest">点击加载视觉参考基因</span>
              </div>
            )}
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <button onClick={handleAnalyze} disabled={!image} className="py-5 bg-slate-900 text-white rounded-[2rem] font-black text-[11px] uppercase tracking-widest transition-all shadow-xl hover:bg-slate-800 active:scale-95">
               {isAnalyzing ? "正在深度解构 (点击取消)..." : "1. 导出视觉分析报告"}
            </button>
            <button onClick={handleExtractPrompt} disabled={!image} className="py-5 bg-theme text-white rounded-[2rem] font-black text-[11px] uppercase tracking-widest transition-all shadow-xl hover:bg-theme-light active:scale-95">
               {isExtracting ? "正在提取指令 (点击取消)..." : "2. 提取架构渲染指令"}
            </button>
          </div>
        </div>

        <div className="bg-white/70 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200 dark:border-slate-800/60 rounded-[3.5rem] p-10 min-h-[500px] shadow-2xl flex flex-col space-y-10 glass-card transition-colors duration-500 w-full">
          <div>
            <div className="flex items-center justify-between mb-8 border-b border-slate-200 dark:border-slate-800 pb-5">
              <h4 className="text-[11px] font-black text-slate-600 dark:text-slate-500 uppercase tracking-[0.4em] italic">视觉分析报告 / Logic Report</h4>
              {analysis && (
                <button onClick={() => handleCopy(analysis)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-theme transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2M8 5a2 2 0 002 2h2a2 2 0 002-2" /></svg>
                </button>
              )}
            </div>
            {analysis ? (
              <div 
                className="text-[14px] text-slate-700 dark:text-slate-300 leading-relaxed italic bg-slate-50/50 dark:bg-slate-950 p-6 rounded-[2rem] border border-slate-100 dark:border-white/5 shadow-inner max-h-[400px] overflow-y-auto custom-scrollbar"
                dangerouslySetInnerHTML={{ __html: renderFormattedContent(analysis) }}
              />
            ) : <p className="text-[12px] text-slate-500 dark:text-slate-400 italic font-medium opacity-50">等待解构报告生成中... 基于 Gemini 3 视觉协议。</p>}
          </div>

          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-8 border-b border-slate-200 dark:border-slate-800 pb-5">
              <h4 className="text-[11px] font-black text-theme uppercase tracking-[0.4em] italic">提取渲染指令 / Render Directives</h4>
            </div>
            {reversePrompt ? (
              <div className="space-y-6 flex-1">
                <div className="bg-slate-50 dark:bg-slate-950/60 p-6 rounded-[2rem] border border-theme/10 group relative shadow-sm">
                   <p className="text-[10px] font-black text-theme uppercase mb-3 tracking-widest">中文设计意向:</p>
                   <p 
                     className="text-[13px] text-slate-700 dark:text-slate-400 italic leading-relaxed"
                     dangerouslySetInnerHTML={{ __html: renderFormattedContent(reversePrompt.zh) }}
                   />
                   <button onClick={() => handleCopy(reversePrompt.zh)} className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-2 text-slate-500 dark:text-slate-400 hover:text-theme transition-all"><svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2M8 5a2 2 0 002 2h2a2 2 0 002-2" strokeWidth={2} /></svg></button>
                </div>
                <div className="bg-theme/5 dark:bg-theme/5 p-8 rounded-[2.5rem] border border-theme/30 group relative shadow-lg">
                   <div className="flex justify-between items-center mb-5">
                      <p className="text-[10px] font-black text-theme uppercase tracking-widest italic">高保真渲染指令 (EN):</p>
                      <div className="flex gap-3">
                        <button onClick={() => handleCopy(reversePrompt.en)} className="px-4 py-2 bg-white/50 dark:bg-slate-800 rounded-xl text-[10px] font-black text-slate-600 dark:text-slate-500 uppercase tracking-widest border border-transparent hover:border-slate-300 transition-all shadow-sm">复制指令</button>
                        <button onClick={() => onImportToArchitect(reversePrompt)} className="px-4 py-2 bg-theme text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-theme-light active:scale-95 transition-all">导入工坊渲染</button>
                      </div>
                   </div>
                   <div className="max-h-[150px] overflow-y-auto custom-scrollbar">
                     <p 
                       className="text-[13px] text-theme dark:text-theme-light font-mono leading-relaxed"
                       dangerouslySetInnerHTML={{ __html: renderFormattedContent(reversePrompt.en) }}
                     />
                   </div>
                </div>
              </div>
            ) : <p className="text-[12px] text-slate-400 italic font-medium opacity-50">等待指令反推结果...</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageAnalyzer;
