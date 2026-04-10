import React, { useState, useRef, useEffect } from 'react';
import { GeminiService, MASTER_STYLES } from '../services/geminiService.ts';
import { ConversationMode, CustomModel, CreativeDomain } from '../types.ts';
import UnifiedInput, { UnifiedPayload } from './UnifiedInput.tsx';
import InpaintEditor from './InpaintEditor.tsx';
import { Ph8UsageService } from '../services/ph8UsageService.ts';
import { getTranslation } from '../i18n/locales.ts';
import type { Language } from '../i18n/locales.ts';
import { MessageCircle, Image, Video, Download, RefreshCw, Copy, StopCircle, UserCircle, Palette, X } from 'lucide-react';

// ─── Mode Icons ────────────────────────────────────────────────────────────────
const MODE_ICONS: Record<ConversationMode, React.FC<{ className?: string }>> = {
  chat:      ({ className = "w-4 h-4" }) => <MessageCircle className={className} />,
  architect: ({ className = "w-4 h-4" }) => <Image className={className} />,
  video:     ({ className = "w-4 h-4" }) => <Video className={className} />,
};


// ─── Preset tags by domain ────────────────────────────────────────────────────
const DOMAIN_PRESETS: Record<CreativeDomain, { label: string; tags: string[] }[]> = {
  architecture: [
    { label: '时段环境', tags: ['晨曦 Dawn', '正午 Noon', '黄金时刻 Golden Hour', '蓝调时刻 Blue Hour', '暮色 Dusk', '深夜 Deep Night'] },
    { label: '建筑风格', tags: ['极简主义 Minimalism', '赛博朋克 Cyberpunk', '侘寂 Wabi-sabi', '包豪斯 Bauhaus', '参数化主义 Parametric', '野兽主义 Brutalism'] },
    { label: '材质纹理', tags: ['清水混凝土', '中空玻璃', '原木质感', '烧毛面花岗岩', '手工黏土砖', '不锈钢蒙皮'] },
    { label: '气象光影', tags: ['丁达尔效应', '全局光照', '逆光 Cinematic', '柔和扩散', '体积云', '大雾 Dense Fog'] }
  ],
  product: [
    { label: '产品分类', tags: ['智能手机', '高端腕表', '极简家具', '电动汽车', '工业无人机', '人体工学椅'] },
    { label: 'CMF 工艺', tags: ['阳极氧化铝', '碳纤维纹理', '拉丝不锈钢', '喷砂工艺', '高光陶瓷', '透明亚克力'] },
    { label: '影棚灯光', tags: ['三点布光', '边缘勾勒光', '柔光箱', '顶部环形灯', '焦外虚化', '微距特写'] }
  ],
  art: [
    { label: '艺术流派', tags: ['波普艺术 Pop Art', '超现实主义', '印象派', '抽象表现主义', '蒸汽波 Vaporwave', '故障艺术 Glitch'] },
    { label: '视觉要素', tags: ['极简排版', '大胆对比色', '波尔卡圆点', '几何重组', '液体流动感', '噪点肌理'] },
    { label: '表现媒介', tags: ['丝网印刷', '油画笔触', '矢量插画', '3D 渲染', '水墨晕染', '拼贴艺术'] }
  ],
  character: [
    { label: '角色原型', tags: ['赛博武士', '暗黑巫师', '未来士兵', '机甲驾驶员', '荒原流浪者', '维多利亚绅士'] },
    { label: '装备材质', tags: ['战损盔甲', '战术尼龙', '仿生肌肉', '做旧皮革', '发光排线', '全息目镜'] },
    { label: '氛围呈现', tags: ['史诗级宏大', '电影级构图', '剪影表现', '暗黑压抑', '圣洁之光', '鲜血溅射'] }
  ]
};

// ─── Message types ────────────────────────────────────────────────────────────
type MsgRole = 'user' | 'assistant';
type MsgType = 'text' | 'image' | 'video' | 'error' | 'thinking';

interface Message {
  id: string;
  role: MsgRole;
  type: MsgType;
  text?: string;
  images?: string[];   // base64 data URLs
  videoUrl?: string;
  timestamp: number;
  rerunPayload?: UnifiedPayload;
}

interface ConversationViewProps {
  modelConfig: CustomModel;
  domain: CreativeDomain;
  instructions: any;
  points: { daily: number; purchased: number };
  onConsumePoints: (n: number) => boolean;
  useThirdPartyGateway?: boolean;
  isDeveloperMode?: boolean;
  showPresetPanel?: boolean;
  onTogglePresetPanel?: () => void;
  language?: Language;
}

const gemini = GeminiService;
let msgId = 0;
const uid = () => `m${++msgId}_${Date.now()}`;

// ─── Text renderer with code block support ────────────────────────────────────
const renderTextWithCode = (text: string, isError: boolean) => {
  const parts = text.split(/(```[\w]*\n?[\s\S]*?```)/g);
  return parts.map((part, i) => {
    const match = part.match(/^```([\w]*)\n?([\s\S]*?)```$/);
    if (match) {
      const lang = match[1] || 'code';
      const code = match[2].trim();
      return (
        <div key={i} className="mt-2 rounded-xl overflow-hidden border border-white/[0.08]">
          <div className="flex items-center justify-between px-3 py-1.5 bg-black/50 border-b border-white/[0.06]">
            <span className="text-[10px] text-white/30 font-mono uppercase">{lang}</span>
            <button
              onClick={() => navigator.clipboard.writeText(code)}
              className="text-[10px] text-white/30 hover:text-white/70 transition-colors px-2 py-0.5 rounded hover:bg-white/10 flex items-center gap-1">
              <Copy className="w-3 h-3" strokeWidth={2} />
              复制
            </button>
          </div>
          <pre className="bg-black/40 p-3 text-[12px] overflow-x-auto font-mono leading-relaxed text-emerald-400 custom-scrollbar">{code}</pre>
        </div>
      );
    }
    return <span key={i} className={`whitespace-pre-wrap ${isError ? 'text-rose-400' : ''}`}>{part}</span>;
  });
};

// ─── Bubble ───────────────────────────────────────────────────────────────────
const Bubble: React.FC<{ msg: Message; onInpaint?: (imageUrl: string) => void; onRerun?: (payload: UnifiedPayload) => void; language?: Language }> = ({ msg, onInpaint, onRerun, language = 'zh-CN' }) => {
  const isUser = msg.role === 'user';
  const [rerunCount, setRerunCount] = useState(1);
  const [aiLogoError, setAiLogoError] = useState(false);

  // 获取用户头像
  const getUserAvatar = () => {
    try {
      const avatarUrl = localStorage.getItem('user-architect-avatar-v120-locked');
      return avatarUrl;
    } catch {
      return null;
    }
  };

  const userAvatar = getUserAvatar();

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} items-end mb-4`}>
      {/* avatar */}
      <div className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center shadow-lg transition-all duration-200 overflow-hidden
        ${isUser
          ? 'bg-gradient-to-br from-indigo-500 to-purple-600 ring-2 ring-indigo-400/30'
          : 'bg-gradient-to-br from-slate-800 to-slate-900 ring-2 ring-white/[0.08]'}`}>
        {isUser ? (
          userAvatar ? (
            <img src={userAvatar} className="w-full h-full object-cover" alt="User" />
          ) : (
            <UserCircle className="w-5 h-5 text-white" strokeWidth={2} />
          )
        ) : (
          aiLogoError ? (
            <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          ) : (
            <img src="/architect/archi01.png" className="w-full h-full object-cover" alt="AI" onError={() => setAiLogoError(true)} />
          )
        )}
      </div>

      {/* bubble */}
      <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-[14px] leading-relaxed transition-all duration-200
        ${isUser
          ? 'bg-[#1e1e2e] text-white/90 rounded-br-sm border border-white/10'
          : 'bg-[#161616] text-white/80 rounded-bl-sm border border-white/[0.06]'}`}>

        {/* thinking */}
        {msg.type === 'thinking' && (
          <div className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
            <span className="flex gap-1">
              {[0,1,2].map(i => <span key={i} className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}
            </span>
            <span className="text-[11px]">{msg.text || '思考中…'}</span>
          </div>
        )}

        {/* text with code block support */}
        {(msg.type === 'text' || msg.type === 'error') && msg.text && (
          <div>{renderTextWithCode(msg.text, msg.type === 'error')}</div>
        )}

        {/* user uploaded images */}
        {msg.images && msg.images.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {msg.images.map((src, i) => (
              <img key={i} src={src} className="max-h-48 rounded-xl object-cover border border-white/10" />
            ))}
          </div>
        )}

        {/* generated images */}
        {msg.type === 'image' && msg.images && msg.images.length > 0 && (
          <div className="mt-2">
            {/* 图片网格 */}
            <div className={`grid gap-3 ${msg.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {msg.images.map((src, i) => (
                <div key={i} className="relative group">
                  <img src={src} className="w-full rounded-xl object-cover border border-white/10 shadow-lg" />
                  {/* 悬浮操作：下载 + 局部修改 */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-200 rounded-xl flex items-center justify-center gap-2">
                    <a href={src} download={`kbitai_${i}.png`}
                      className="min-w-[44px] min-h-[44px] bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center hover:bg-white/30 transition-all duration-150 active:scale-95">
                      <Download className="w-5 h-5 text-white" strokeWidth={2} />
                    </a>
                    {onInpaint && (
                      <button onClick={() => onInpaint(src)}
                        className="min-h-[44px] px-3 py-2 bg-indigo-600/80 backdrop-blur-sm rounded-lg text-white text-[12px] font-bold hover:bg-indigo-500 transition-all duration-150 active:scale-95 flex items-center gap-1.5">
                        <Palette className="w-4 h-4" strokeWidth={2} />
                        {language === 'zh-CN' ? '局部修改' : 'Inpaint'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* 常驻操作栏：再次渲染 + 数量选择 */}
            {onRerun && msg.rerunPayload && (
              <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-white/[0.06]">
                <span className="text-[10px] text-white/25 uppercase tracking-wider shrink-0">{language === 'zh-CN' ? '数量' : 'Quantity'}</span>
                {[1, 2, 3, 4].map(n => (
                  <button key={n} onClick={() => setRerunCount(n)}
                    className={`min-w-[30px] min-h-[30px] flex items-center justify-center rounded-lg text-[12px] font-medium transition-all duration-150 active:scale-95
                      ${rerunCount === n
                        ? 'bg-indigo-500/25 text-indigo-300 border border-indigo-500/40'
                        : 'bg-white/[0.04] text-white/35 hover:bg-white/[0.08] hover:text-white/60'}`}>
                    {n}
                  </button>
                ))}
                <button
                  onClick={() => onRerun({ ...msg.rerunPayload!, imageConfig: msg.rerunPayload!.imageConfig ? { ...msg.rerunPayload!.imageConfig, imageCount: rerunCount } : undefined })}
                  className="ml-auto flex items-center gap-1.5 min-h-[30px] px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/60 text-[12px] font-medium hover:bg-indigo-500/20 hover:border-indigo-500/30 hover:text-indigo-300 transition-all duration-150 active:scale-95">
                  <RefreshCw className="w-3.5 h-3.5" strokeWidth={2} />
                  {language === 'zh-CN' ? '再次渲染' : 'Regenerate'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* video */}
        {msg.type === 'video' && msg.videoUrl && (
          <video src={msg.videoUrl} controls className="w-full rounded-xl mt-1 border border-white/10" />
        )}

        <p className="text-[9px] opacity-30 mt-1 text-right">
          {new Date(msg.timestamp).toLocaleTimeString('zh', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────
const ConversationView: React.FC<ConversationViewProps> = ({
  modelConfig, domain, instructions, points, onConsumePoints, useThirdPartyGateway, isDeveloperMode,
  showPresetPanel = false, onTogglePresetPanel, language = 'zh-CN'
}) => {
  const t = getTranslation(language);
  const [messages, setMessages] = useState<Message[]>([]);
  const [mode, setMode] = useState<ConversationMode>('chat');
  const [isLoading, setIsLoading] = useState(false);
  const [inpaintImage, setInpaintImage] = useState<string | null>(null);
  const [showStylePicker, setShowStylePicker] = useState(false);
  const [expandedPresetGroup, setExpandedPresetGroup] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string>('');
  const [selectedPresets, setSelectedPresets] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const chatHistoryRef = useRef<any[]>([]);

  const domainStyles = MASTER_STYLES.filter(s => s.domain === domain);
  const domainPresets = DOMAIN_PRESETS[domain] || [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMsg = (msg: Omit<Message, 'id' | 'timestamp'>) =>
    setMessages(prev => [...prev, { ...msg, id: uid(), timestamp: Date.now() }]);

  const updateLast = (patch: Partial<Message>) =>
    setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, ...patch } : m));

  const handleSubmit = async (payload: UnifiedPayload) => {
    if (isLoading) return;

    // 如果选择了大师风格或预设标签，将其添加到提示词中
    let finalText = payload.text;
    if (payload.mode === 'architect') {
      const additions: string[] = [];
      if (selectedStyle) {
        const styleObj = MASTER_STYLES.find(s => s.name === selectedStyle);
        if (styleObj) additions.push(`Style: ${styleObj.name} - ${styleObj.logic}`);
      }
      if (selectedPresets.length > 0) {
        additions.push(`Presets: ${selectedPresets.join(', ')}`);
      }
      if (additions.length > 0) {
        finalText = `${payload.text}\n\n${additions.join('\n')}`;
      }
    }

    // add user bubble
    addMsg({ role: 'user', type: 'text', text: payload.text, images: payload.images.map(f => f.data) });

    setIsLoading(true);
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    // thinking bubble
    addMsg({ role: 'assistant', type: 'thinking', text: t.buttons.thinkingText });

    try {
      const m = payload.mode;

      // ── CHAT ──────────────────────────────────────────────────────────────
      if (m === 'chat') {
        const files = payload.images.map(f => ({ name: f.name, type: f.type, mimeType: f.type, data: f.data }));
        const res = await gemini.chat(finalText, chatHistoryRef.current, 'FAST', files, instructions, modelConfig, signal);
        const text = res?.text || '';
        updateLast({ type: 'text', text });
        chatHistoryRef.current = [...chatHistoryRef.current,
          { role: 'user', parts: [{ text: finalText }] },
          { role: 'model', parts: [{ text }] }
        ];

        // 获取 PH8 真实费用并扣除积分
        setTimeout(async () => {
          try {
            const session = localStorage.getItem('architect-invite-session');
            if (!session) return;
            const sessionData = JSON.parse(session);
            const userId = sessionData.user_id || sessionData.email;

            const result = await Ph8UsageService.getLatestUsage(userId);
            if (result.success && result.data) {
              const realCost = result.data.total_tokens || 0;
              console.log('[PH8真实费用-Chat]', {
                requestId: result.data.request_id,
                cost: realCost,
                costInYuan: (realCost * 0.0001).toFixed(4),
                model: result.data.model
              });

              if (realCost > 0 && onConsumePoints) {
                const userPoints = Math.ceil(realCost / 10);
                const deducted = onConsumePoints(userPoints);
                if (!deducted) {
                  console.warn('[PH8费用] 积分不足，无法扣除:', userPoints);
                }
              }
            }
          } catch (err) {
            console.error('获取PH8真实费用失败:', err);
          }
        }, 500);
      }

      // ── IMAGE ─────────────────────────────────────────────────────────────
      else if (m === 'architect') {
        updateLast({ type: 'thinking', text: t.buttons.generatingImage });
        const baseRefs = payload.images.map(f => f.data);
        const config = payload.imageConfig || { aspectRatio: '1:1', imageSize: '1K', modelTier: 'FAST', imageCount: 1 };
        const imgs: string[] = await gemini.generateImage(
          finalText,
          {
            aspectRatio: config.aspectRatio,
            imageSize: config.imageSize,
            modelTier: config.modelTier,
            imageCount: config.imageCount,
            temperature: 1.0,
            top_p: 0.95
          },
          false, baseRefs, [], [], [], undefined, undefined, undefined,
          instructions, modelConfig, signal, domain
        );
        updateLast({ type: 'image', images: Array.isArray(imgs) ? imgs : [], text: undefined, rerunPayload: payload });

        // 获取 PH8 真实费用并扣除积分
        setTimeout(async () => {
          try {
            const session = localStorage.getItem('architect-invite-session');
            if (!session) return;
            const sessionData = JSON.parse(session);
            const userId = sessionData.user_id || sessionData.email;

            const result = await Ph8UsageService.getLatestUsage(userId);
            if (result.success && result.data) {
              const realCost = result.data.total_tokens || 0;
              console.log('[PH8真实费用-Image]', {
                requestId: result.data.request_id,
                cost: realCost,
                costInYuan: (realCost * 0.0001).toFixed(4),
                model: result.data.model
              });

              if (realCost > 0 && onConsumePoints) {
                const userPoints = Math.ceil(realCost / 10);
                const deducted = onConsumePoints(userPoints);
                if (!deducted) {
                  console.warn('[PH8费用] 积分不足，无法扣除:', userPoints);
                }
              }
            }
          } catch (err) {
            console.error('获取PH8真实费用失败:', err);
          }
        }, 500);
      }

      // ── VIDEO ─────────────────────────────────────────────────────────────
      else if (m === 'video') {
        updateLast({ type: 'thinking', text: t.buttons.generatingVideo });
        const assets = payload.images.map(f => f.data);
        const res: any = await gemini.generateVideo(finalText, assets, '16:9', instructions, signal);
        if (res?.url) updateLast({ type: 'video', videoUrl: res.url, text: undefined });
        else updateLast({ type: 'error', text: t.buttons.videoGenerationFailed });

        // 获取 PH8 真实费用并扣除积分
        setTimeout(async () => {
          try {
            const session = localStorage.getItem('architect-invite-session');
            if (!session) return;
            const sessionData = JSON.parse(session);
            const userId = sessionData.user_id || sessionData.email;

            const result = await Ph8UsageService.getLatestUsage(userId);
            if (result.success && result.data) {
              const realCost = result.data.total_tokens || 0;
              console.log('[PH8真实费用-Video]', {
                requestId: result.data.request_id,
                cost: realCost,
                costInYuan: (realCost * 0.0001).toFixed(4),
                model: result.data.model
              });

              if (realCost > 0 && onConsumePoints) {
                const userPoints = Math.ceil(realCost / 10);
                const deducted = onConsumePoints(userPoints);
                if (!deducted) {
                  console.warn('[PH8费用] 积分不足，无法扣除:', userPoints);
                }
              }
            }
          } catch (err) {
            console.error('获取PH8真实费用失败:', err);
          }
        }, 500);
      }

    } catch (err: any) {
      if (err?.name !== 'AbortError') updateLast({ type: 'error', text: err?.message || '请求失败' });
      else updateLast({ type: 'error', text: '已取消' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInpaintSubmit = async (maskDataUrl: string, prompt: string) => {
    if (!inpaintImage) return;
    setInpaintImage(null);
    setIsLoading(true);

    // add user bubble
    addMsg({ role: 'user', type: 'text', text: `${language === 'zh-CN' ? '局部修改' : 'Inpaint'}: ${prompt}`, images: [inpaintImage] });
    addMsg({ role: 'assistant', type: 'thinking', text: t.buttons.inpainting });

    try {
      const imgs: string[] = await gemini.generateImage(
        prompt,
        { aspectRatio: '1:1', imageSize: '1K', modelTier: 'FAST', imageCount: 1, temperature: 1.0, top_p: 0.95 },
        false, [inpaintImage], [], [], [], maskDataUrl, prompt, undefined,
        instructions, modelConfig, abortRef.current?.signal, domain
      );
      updateLast({ type: 'image', images: Array.isArray(imgs) ? imgs : [], text: undefined });

      // 获取 PH8 真实费用并扣除积分
      setTimeout(async () => {
        try {
          const session = localStorage.getItem('architect-invite-session');
          if (!session) return;
          const sessionData = JSON.parse(session);
          const userId = sessionData.user_id || sessionData.email;

          const result = await Ph8UsageService.getLatestUsage(userId);
          if (result.success && result.data) {
            const realCost = result.data.total_tokens || 0;
            console.log('[PH8真实费用-Inpaint]', {
              requestId: result.data.request_id,
              cost: realCost,
              costInYuan: (realCost * 0.0001).toFixed(4),
              model: result.data.model
            });

            if (realCost > 0 && onConsumePoints) {
              const userPoints = Math.ceil(realCost / 10);
              const deducted = onConsumePoints(userPoints);
              if (!deducted) {
                console.warn('[PH8费用] 积分不足，无法扣除:', userPoints);
              }
            }
          }
        } catch (err) {
          console.error('获取PH8真实费用失败:', err);
        }
      }, 500);
    } catch (err: any) {
      if (err?.name !== 'AbortError') updateLast({ type: 'error', text: err?.message || 'Inpaint 失败' });
      else updateLast({ type: 'error', text: '已取消' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex flex-col h-screen transition-colors duration-300" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>

      {/* ── messages ── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center select-none px-4">
            <div className="w-20 h-20 rounded-full overflow-hidden shadow-2xl shadow-indigo-500/40 animate-float">
              <img src="/architect/archi01.png" className="w-full h-full object-cover" alt="Kbit" />
            </div>
            <div className="space-y-2">
              <p className="text-[18px] font-bold" style={{ color: 'var(--text-primary)' }}>{t.main.welcome}</p>
              <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>{t.main.welcomeMessage}</p>
            </div>
            <div className="flex gap-3 flex-wrap justify-center max-w-2xl">
              {[
                { icon: 'chat',      text: t.tabs.chat,      mode: 'chat'      as ConversationMode },
                { icon: 'architect', text: t.tabs.imageGen,  mode: 'architect' as ConversationMode },
                { icon: 'video',     text: t.tabs.video,     mode: 'video'     as ConversationMode },
              ].map(s => {
                const Icon = MODE_ICONS[s.icon as ConversationMode];
                return (
                  <button key={s.mode} onClick={() => setMode(s.mode)}
                    className="flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl border text-[13px] font-medium transition-all duration-150 shadow-sm hover:shadow-md active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-primary)'
                    }}>
                    <Icon className="w-4 h-4" />
                    <span>{s.text}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map(msg => <Bubble key={msg.id} msg={msg} onInpaint={msg.type === 'image' ? setInpaintImage : undefined} onRerun={msg.type === 'image' ? handleSubmit : undefined} language={language} />)}
        </div>
        <div ref={bottomRef} />
      </div>

      {/* ── Inpaint Editor ── */}
      {inpaintImage && (
        <InpaintEditor
          imageUrl={inpaintImage}
          onSubmit={handleInpaintSubmit}
          onClose={() => setInpaintImage(null)}
          language={language}
        />
      )}

      {/* ── stop button ── */}
      {isLoading && (
        <div className="flex justify-center pb-3">
          <button onClick={() => abortRef.current?.abort()}
            className="flex items-center gap-2 min-h-[44px] px-5 py-2 rounded-xl bg-slate-800 border border-white/10 text-slate-300 text-[13px] font-medium hover:bg-slate-700 transition-all duration-150 active:scale-95 focus:outline-none focus:ring-2 focus:ring-rose-500/40 shadow-lg">
            <StopCircle className="w-4 h-4 text-rose-400" strokeWidth={2} />
            {language === 'zh-CN' ? '停止生成' : 'Stop'}
          </button>
        </div>
      )}

      {/* ── unified input ── */}
      <div className="shrink-0 border-t border-white/[0.06] bg-[#0a0a0a]/95 backdrop-blur-xl py-4">
        {/* 选中的风格和预设标签 */}
        {mode === 'architect' && (selectedStyle || selectedPresets.length > 0) && (
          <div className="max-w-5xl mx-auto px-4 mb-3">
            <div className="flex flex-wrap gap-2">
              {selectedStyle && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-400 text-[11px] font-medium">
                  <Palette className="w-3 h-3" strokeWidth={2} />
                  <span>{selectedStyle.split(' ')[0]}</span>
                  <button onClick={() => setSelectedStyle('')}
                    className="w-3.5 h-3.5 flex items-center justify-center rounded hover:bg-white/20 transition-all">
                    <X className="w-3 h-3" strokeWidth={2} />
                  </button>
                </div>
              )}
              {selectedPresets.map(preset => (
                <div key={preset} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/50 text-[11px] font-medium">
                  <span>{preset}</span>
                  <button onClick={() => setSelectedPresets(prev => prev.filter(p => p !== preset))}
                    className="w-3.5 h-3.5 flex items-center justify-center rounded hover:bg-white/20 transition-all">
                    <X className="w-3 h-3" strokeWidth={2} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        <UnifiedInput mode={mode} onModeChange={setMode} onSubmit={handleSubmit} isLoading={isLoading} language={language} />
      </div>

      {/* ── 预设风格面板（双击领域按钮触发） ── */}
      {showPresetPanel && (
        <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-16 px-4"
          onClick={e => { if (e.target === e.currentTarget) onTogglePresetPanel?.(); }}>
          <div className="w-full max-w-3xl bg-[#111111] border border-white/[0.08] rounded-2xl shadow-2xl overflow-y-auto max-h-[80vh] custom-scrollbar">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] sticky top-0 bg-[#111111]">
              <p className="text-base font-semibold text-white/90">预设风格</p>
              <div className="flex items-center gap-3">
                {(selectedStyle || selectedPresets.length > 0) && (
                  <button onClick={() => { setSelectedStyle(''); setSelectedPresets([]); }}
                    className="text-[11px] text-red-400 hover:text-red-300 transition-all flex items-center gap-1">
                    <X className="w-3 h-3" strokeWidth={2} />
                    清除全部
                  </button>
                )}
                <button onClick={onTogglePresetPanel}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-all">
                  <X className="w-5 h-5" strokeWidth={2} />
                </button>
              </div>
            </div>

            <div className="px-6 py-4 space-y-6">
              {/* 大师风格 */}
              <div>
                <p className="text-[11px] font-medium uppercase text-white/30 tracking-widest mb-3">大师风格</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {domainStyles.map(style => (
                    <button key={style.name}
                      onClick={() => setSelectedStyle(s => s === style.name ? '' : style.name)}
                      className={`min-h-[44px] px-3 py-2 rounded-xl text-left text-[12px] transition-all duration-150 active:scale-95
                        ${selectedStyle === style.name
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'bg-white/[0.03] border border-white/[0.06] text-white/50 hover:bg-white/[0.06] hover:text-white/70'}`}>
                      <div className="font-medium truncate">{style.name.split(' ')[0]}</div>
                      <div className="text-[10px] opacity-50 truncate">{style.name.split(' ').slice(1).join(' ')}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 预设标签 */}
              {domainPresets.map(category => (
                <div key={category.label}>
                  <p className="text-[11px] font-medium uppercase text-white/30 tracking-widest mb-3">{category.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {category.tags.map(tag => {
                      const isSelected = selectedPresets.includes(tag);
                      return (
                        <button key={tag}
                          onClick={() => setSelectedPresets(prev => isSelected ? prev.filter(t => t !== tag) : [...prev, tag])}
                          className={`min-h-[36px] px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-150 active:scale-95
                            ${isSelected
                              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                              : 'bg-white/[0.03] border border-white/[0.06] text-white/40 hover:bg-white/[0.06] hover:text-white/70'}`}>
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConversationView;
