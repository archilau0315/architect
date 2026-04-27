
import React, { useState, useRef, useEffect } from 'react';
import { GeminiService, DEFAULT_SYSTEM_PRESETS } from '../services/geminiService.ts';
import { ChatMessage, CustomModel, ChatSession, ExtendedChatMessage, SearchContextData } from '../types.ts';
import { ContentIdService } from '../services/contentIdService.ts';
import { Ph8UsageService } from '../services/ph8UsageService.ts';

interface ChatBotProps {
  instructions?: typeof DEFAULT_SYSTEM_PRESETS;
  onReset?: () => void;
  fontSize?: number;
  modelConfig: CustomModel;
  onBusyStateChange?: (busy: boolean) => void;
  points?: { daily: number; purchased: number };
  onConsumePoints?: (amount: number) => Promise<boolean>;
}

const SESSIONS_STORAGE_KEY = 'architect-chat-sessions-v135';

// 替代 UUID 生成器
const generateId = () => Math.random().toString(36).substring(2, 11) + Date.now().toString(36);

const ChatBot: React.FC<ChatBotProps> = ({ instructions, onReset, fontSize = 15, modelConfig, onBusyStateChange, points, onConsumePoints }) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // 默认收起
  const [searchQuery, setSearchQuery] = useState('');
  
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [thinkingMode, setThinkingMode] = useState<'FAST' | 'ADVANCED' | 'DEEP'>('FAST');
  const [selectedFiles, setSelectedFiles] = useState<{ name: string, type: string, data: string }[]>([]);
  const [copyStatus, setCopyStatus] = useState<number | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  
  const [isSearching, setIsSearching] = useState(false);
  const [searchContext, setSearchContext] = useState<SearchContextData | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 格式化函数：文本 -> 带霓虹效果的 HTML
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

  // 初始化加载会话
  useEffect(() => {
    const saved = localStorage.getItem(SESSIONS_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ChatSession[];
        setSessions(parsed);
        if (parsed.length > 0) setCurrentSessionId(parsed[0].id);
      } catch (e) { console.error("Failed to load sessions", e); }
    }
  }, []);

  // 消息滚动
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [sessions, currentSessionId]);

  const currentSession = sessions.find(s => s.id === currentSessionId);
  const messages = currentSession?.messages || [];

  const filteredSessions = sessions.filter(s => 
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const updateSessionsAndStore = (newSessions: ChatSession[]) => {
    setSessions(newSessions);
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(newSessions));
  };

  const createNewChat = () => {
    const newSession: ChatSession = {
      id: generateId(),
      title: '新对话',
      messages: [],
      timestamp: Date.now()
    };
    const nextSessions = [newSession, ...sessions];
    updateSessionsAndStore(nextSessions);
    setCurrentSessionId(newSession.id);
    setInput('');
    setSelectedFiles([]);
    setIsSidebarOpen(false); // 开启新对话后自动收起
  };

  const deleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!window.confirm("确定删除此对话吗？此操作不可撤销。")) return;
    
    setSessions(prev => {
      const nextSessions = prev.filter(s => s.id !== id);
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(nextSessions));
      if (currentSessionId === id) {
        setCurrentSessionId(nextSessions.length > 0 ? nextSessions[0].id : null);
      }
      return nextSessions;
    });
  };

  const startRename = (id: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(id);
    setEditTitle(currentTitle);
  };

  const saveRename = () => {
    if (!editingSessionId) return;
    const nextSessions = sessions.map(s => s.id === editingSessionId ? { ...s, title: editTitle || s.title } : s);
    updateSessionsAndStore(nextSessions);
    setEditingSessionId(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        setSelectedFiles(prev => [...prev, { name: file.name, type: file.type || 'application/octet-stream', data: base64 }]);
      };
      reader.readAsDataURL(file as Blob);
    });
    e.target.value = '';
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          setSelectedFiles(prev => [...prev, { name: `VoiceRecord_${new Date().getTime()}.webm`, type: 'audio/webm', data: base64 }]);
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = window.setInterval(() => { setRecordingTime(prev => prev + 1); }, 1000);
    } catch (err) { alert("无法访问麦克风。"); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const removeFile = (index: number) => { setSelectedFiles(prev => prev.filter((_, i) => i !== index)); };

  const executeSearch = async (query: string): Promise<SearchContextData | null> => {
    try {
      const response = await fetch('/api/search/web', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, force: false })
      });
      const data = await response.json();
      if (data.success && data.searched && data.context) {
        return {
          searched: true,
          context: data.context,
          results: data.result?.results || []
        };
      }
    } catch (err) {
      console.error('[Search] 联网搜索失败:', err);
    }
    return null;
  };

  const handleSend = async (useSearch: boolean = false) => {
    if (isLoading) {
      abortControllerRef.current?.abort();
      setIsLoading(false);
      setIsSearching(false);
      onBusyStateChange?.(false);
      return;
    }

    if ((!input.trim() && selectedFiles.length === 0)) return;

    let activeSessionId = currentSessionId;
    let nextSessions = [...sessions];

    if (!activeSessionId) {
      const newSession: ChatSession = { id: generateId(), title: '新对话', messages: [], timestamp: Date.now() };
      nextSessions = [newSession, ...nextSessions];
      activeSessionId = newSession.id;
      setCurrentSessionId(activeSessionId);
    }

    const userPrompt = input;
    const currentFiles = selectedFiles.map(f => ({ mimeType: f.type, data: f.data, fileName: f.name }));
    setInput('');
    setSelectedFiles([]);
    setIsLoading(true);
    setIsSearching(true);
    onBusyStateChange?.(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let currentSearchContext: SearchContext | null = null;
    
    try {
      if (useSearch || shouldAutoSearch(userPrompt)) {
        currentSearchContext = await executeSearch(userPrompt);
        setSearchContext(currentSearchContext);
      }

      const targetSession = nextSessions.find(s => s.id === activeSessionId)!;
      const contextMessages = targetSession.messages.slice(-8);
      const historyForAPI = contextMessages.map(m => ({ role: m.role, parts: m.parts || [{ text: m.text }] }));
      
      let enhancedPrompt = userPrompt;
      if (currentSearchContext?.context) {
        enhancedPrompt = currentSearchContext.context + '\n\n用户问题: ' + userPrompt;
      }
      
      const result = await GeminiService.chat(enhancedPrompt, historyForAPI, thinkingMode, currentFiles, instructions, modelConfig, controller.signal);
      
      const contentId = ContentIdService.generateId();
      
      const userMsg: ExtendedChatMessage = { role: 'user', text: userPrompt, parts: result.partsSent, timestamp: Date.now() };
      const modelMsg: ExtendedChatMessage = { 
        role: 'model', 
        text: result.text, 
        sources: result.sources, 
        timestamp: Date.now(), 
        contentId,
        searchContext: currentSearchContext
      };
      
      const updatedMessages = [...targetSession.messages, userMsg, modelMsg];
      
      let updatedTitle = targetSession.title;
      if (targetSession.messages.length === 0) {
        updatedTitle = userPrompt.length > 15 ? userPrompt.substring(0, 15) + '...' : userPrompt;
      }

      const updatedSessions = nextSessions.map(s => s.id === activeSessionId ? { ...s, title: updatedTitle, messages: updatedMessages, timestamp: Date.now() } : s);
      updateSessionsAndStore(updatedSessions);
      
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
      
      setTimeout(async () => {
        try {
          const usageResult = await Ph8UsageService.getLatestUsage(userId);
          if (usageResult.success && usageResult.data) {
            const realCost = usageResult.data.total_tokens || 0;
            console.log('[Chat PH8真实费用]', {
              requestId: usageResult.data.request_id,
              cost: realCost,
              costInYuan: (realCost * 0.0001).toFixed(4),
              model: usageResult.data.model
            });

            if (realCost > 0 && onConsumePoints) {
              const userPoints = Math.ceil(realCost / 10);
              const deducted = await onConsumePoints(userPoints);
              if (!deducted) {
                console.warn('[Chat PH8费用] 积分不足，无法扣除:', userPoints);
              }
            }
          }
        } catch (err) {
          console.error('[Chat] 获取PH8真实费用失败:', err);
        }
      }, 500);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log("Chat cancelled by user.");
      } else {
        const targetSession = nextSessions.find(s => s.id === activeSessionId)!;
        const errorMsg: ExtendedChatMessage = { role: 'model', text: `引擎处理异常: ${err.message}`, timestamp: Date.now() };
        const updatedSessions = nextSessions.map(s => s.id === activeSessionId ? { ...s, messages: [...s.messages, errorMsg] } : s);
        updateSessionsAndStore(updatedSessions);
      }
    } finally { 
      if (abortControllerRef.current === controller) {
        setIsLoading(false); 
        setIsSearching(false);
        onBusyStateChange?.(false);
      }
    }
  };

  const shouldAutoSearch = (query: string): boolean => {
    const searchKeywords = [
      '2024', '2025', '最新', '今天', '现在', '最近', '最新消息', '最新动态',
      '趋势', '行情', '新闻', '天气', '股票', '价格', '政策', '发布',
      '排名', '数据', '统计', '报告', '研究', '分析', '对比',
      '设计趋势', '行业案例', '素材参考', '外部资料', '实时信息'
    ];
    return searchKeywords.some(keyword => query.includes(keyword));
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopyStatus(index);
    setTimeout(() => setCopyStatus(null), 2000);
  };

  const getFileIcon = (type: string) => {
    if (type.includes('image')) return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
    );
    if (type.includes('pdf')) return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
    );
    if (type.includes('audio')) return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" /></svg>
    );
    return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
    );
  };

  return (
    <div className="w-full h-full flex flex-col gap-12 animate-in fade-in duration-700">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-8">
        <div className="space-y-1">
          <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight italic">创意顾问咨询 <span className="text-theme font-normal tracking-normal">Creative Consultant</span></h3>
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.3em] leading-none">Multi-Modal Spatial Design Intelligence</p>
        </div>
      </div>

      <div className="flex-1 flex h-full w-full bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800/60 rounded-[2.5rem] shadow-2xl overflow-hidden glass-card transition-all duration-500 font-sans relative">
        {/* Sidebar Drawer */}
        {isSidebarOpen && (
          <div 
            className="absolute inset-0 z-[55] bg-slate-950/20 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
        
        <div className={`absolute top-0 left-0 z-[60] h-full w-72 border-r shadow-2xl transform transition-transform duration-500 ease-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`} style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
           <div className="p-6 border-b flex flex-col gap-4" style={{ borderColor: 'var(--border-color)' }}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>历史对话</span>
                <div className="flex gap-2">
                  <button onClick={createNewChat} className="w-8 h-8 rounded-lg bg-theme text-white flex items-center justify-center hover:bg-theme-light transition-all active:scale-95 shadow-lg shadow-theme" title="开启新对话">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                  </button>
                  <button onClick={() => setIsSidebarOpen(false)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:text-rose-500 transition-all" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="搜索对话..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full border rounded-xl px-4 py-2 text-[11px] font-medium outline-none focus:ring-2 focus:ring-theme/20 transition-all"
                  style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                />
                <svg xmlns="http://www.w3.org/2000/svg" className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
           </div>
           <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              {filteredSessions.map(s => (
                <div 
                  key={s.id} 
                  onClick={() => { if(editingSessionId !== s.id) { setCurrentSessionId(s.id); setIsSidebarOpen(false); } }}
                  className={`group flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer transition-all border ${currentSessionId === s.id ? 'bg-theme/5 border border-theme/20' : 'border-transparent'}`}
                  style={currentSessionId !== s.id ? { backgroundColor: 'transparent' } : undefined}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                     <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 shrink-0 ${currentSessionId === s.id ? 'text-theme' : ''}`} style={{ color: currentSessionId === s.id ? undefined : 'var(--text-tertiary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                     {editingSessionId === s.id ? (
                        <input 
                          autoFocus
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onBlur={saveRename}
                          onKeyDown={(e) => e.key === 'Enter' && saveRename()}
                          className="bg-transparent border-none outline-none text-[12px] font-bold w-full"
                          style={{ color: 'var(--text-primary)' }}
                        />
                     ) : (
                        <span className="text-[12px] font-bold truncate" style={{ color: 'var(--text-primary)' }}>{s.title}</span>
                     )}
                  </div>
                  {editingSessionId !== s.id && (
                    <div className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${currentSessionId === s.id ? 'opacity-100' : ''}`}>
                       <button onClick={(e) => startRename(s.id, s.title, e)} className="p-1 hover:text-theme transition-colors" style={{ color: 'var(--text-tertiary)' }}><svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                       <button onClick={(e) => deleteChat(s.id, e)} className="p-1 hover:text-rose-500 transition-colors" style={{ color: 'var(--text-tertiary)' }}><svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                    </div>
                  )}
                </div>
              ))}
           </div>
        </div>

        <div className="flex-1 flex flex-col h-full overflow-hidden relative">
          <div className="px-8 py-6 border-b flex items-center justify-between z-10" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-2.5 rounded-xl transition-all shadow-sm flex items-center gap-2 group"
                style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                title="查看历史对话"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 group-hover:rotate-12 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">会话库</span>
              </button>
              <div className="w-px h-6 mx-2" style={{ backgroundColor: 'var(--border-color)' }} />
              <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest italic" style={{ color: 'var(--text-secondary)' }}>{currentSession?.title || 'Multi-Modal Consultation Engine'}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="flex p-1.5 rounded-2xl gap-1 ring-1 shadow-inner" style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' }}>
                {[{ id: 'FAST', label: '极速', desc: 'Precise' }, { id: 'ADVANCED', label: '逻辑', desc: 'Advanced' }, { id: 'DEEP', label: '深度', desc: 'Deep' }].map(mode => (
                  <button key={mode.id} onClick={() => setThinkingMode(mode.id as any)} className={`px-4 py-2 rounded-xl transition-all duration-300 flex flex-col items-center min-w-[70px] ${thinkingMode === mode.id ? 'bg-theme text-white shadow-xl scale-105' : ''}`} style={thinkingMode !== mode.id ? { color: 'var(--text-secondary)' } : undefined}>
                    <span className="text-[11px] font-black uppercase">{mode.label}</span>
                    <span className="text-[9px] font-bold opacity-60 uppercase">{mode.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-10 space-y-12 scroll-smooth custom-scrollbar">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center opacity-10 text-center select-none">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-32 h-32 mb-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={0.3} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                <p className="text-2xl font-black uppercase tracking-[0.5em] italic">Waiting Consultation</p>
                <p className="text-sm font-bold mt-4 uppercase tracking-widest opacity-60">点击左上角“会话库”管理历史对话</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-4 duration-500`}>
                <div className={`max-w-[98%] relative group ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                  <div className={`inline-block rounded-[2rem] px-8 py-6 max-w-full leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-theme text-white shadow-theme' : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200 rounded-tl-none border border-slate-200 dark:border-slate-700/50 shadow-xl'}`}>
                    {msg.text && (
                      <p 
                        className="font-medium" 
                        style={{ fontSize: `${fontSize}px` }}
                        dangerouslySetInnerHTML={{ __html: renderFormattedContent(msg.text) }}
                      />
                    )}
                    {msg.role === 'model' && msg.text && (
                      <p className="mt-4 pt-4 border-t border-slate-200/50 dark:border-slate-700/30">
                        <span className="text-blue-400 dark:text-blue-400" style={{ fontSize: `${fontSize}px` }}>【人工智能Kbitai生成咨询建议】</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-2 select-all" style={{ fontSize: '10px' }}>
                          [AI Generated|KBITAI|ID:{msg.contentId || ContentIdService.generateId()}|{new Date(msg.timestamp).toISOString().split('T')[0]}]
                        </span>
                      </p>
                    )}
                    {msg.parts && msg.parts.length > 1 && (
                      <div className={`mt-5 flex flex-wrap gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.parts.map((p, idx) => p.inlineData && (
                          <div key={idx} className="flex flex-col gap-1 items-start">
                            {p.inlineData.mimeType.startsWith('image/') ? (
                              <img 
                                src={`data:${p.inlineData.mimeType};base64,${p.inlineData.data}`} 
                                className="w-16 h-16 object-cover rounded-xl border border-black/10 dark:border-white/10 shadow-sm transition-transform hover:scale-105 cursor-pointer" 
                                alt="Thumbnail"
                                onClick={() => {
                                  const win = window.open();
                                  if (win) win.document.write(`<img src="data:${p.inlineData.mimeType};base64,${p.inlineData.data}" style="max-width:100%; height:auto;">`);
                                }}
                              />
                            ) : (
                              <div className="px-3 py-1.5 bg-black/10 dark:bg-white/5 rounded-xl text-[10px] font-black flex items-center gap-2 border border-white/10 uppercase">
                                <span>{getFileIcon(p.inlineData.mimeType)}</span><span className="opacity-70">载入内核参考</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {msg.role === 'model' && msg.sources && msg.sources.length > 0 && (
                      <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-700/50 space-y-3">
                        <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest italic flex items-center gap-2">检索信源增强</p>
                        <div className="flex flex-wrap gap-2">{msg.sources.map((source, idx) => (<a key={idx} href={source.uri} target="_blank" rel="noopener noreferrer" className="px-4 py-1.5 bg-slate-50 dark:bg-slate-900 rounded-full text-[10px] text-theme dark:text-theme-light font-black border border-slate-200 dark:border-white/5 hover:bg-theme hover:text-white shadow-sm transition-all">{source.title || 'Source Link'}</a>))}</div>
                      </div>
                    )}
                    {msg.role === 'model' && msg.searchContext && msg.searchContext.searched && (
                      <div className="mt-6 pt-6 border-t border-amber-100 dark:border-amber-900/50 space-y-3">
                        <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest italic flex items-center gap-2">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                          </svg>
                          联网搜索结果
                        </p>
                        <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                          {msg.searchContext.results.slice(0, 5).map((result, idx) => (
                            <a 
                              key={idx} 
                              href={result.url} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="px-4 py-2 bg-amber-50/50 dark:bg-amber-900/20 rounded-xl text-[11px] font-medium text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50 hover:bg-amber-100 dark:hover:bg-amber-800/30 shadow-sm transition-all max-w-[200px]"
                            >
                              <span className="block truncate font-bold">{result.title}</span>
                              <span className="block text-[9px] opacity-70 truncate">{result.url}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className={`mt-3 flex items-center gap-5 text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 opacity-0 group-hover:opacity-100 transition-all ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                     <span className="font-mono">{new Date(msg.timestamp).toLocaleString('zh', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                     <button onClick={() => handleCopy(msg.text, i)} title={copyStatus === i ? '已复制' : '复制内容'}
                       className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${copyStatus === i ? 'text-emerald-500 bg-emerald-500/10' : 'text-slate-400 hover:text-theme hover:bg-white/5'}`}>
                       {copyStatus === i
                         ? <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                         : <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                       }
                       {copyStatus === i ? '已复制' : '复制'}
                     </button>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="justify-start animate-in slide-in-from-left-4 flex">
                 <div className="bg-slate-100 dark:bg-slate-800 rounded-[1.5rem] rounded-tl-none px-8 py-5 flex items-center gap-5 border border-slate-200 dark:border-slate-700/50 shadow-sm">
                    <div className="flex items-center gap-2">
                      {isSearching && (
                        <div className="flex items-center gap-2 mr-4">
                          <svg className="w-5 h-5 text-amber-500 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                          </svg>
                          <span className="text-[11px] font-black uppercase tracking-[0.15em] text-amber-600 dark:text-amber-400">Searching...</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        {[0,1,2,3,4].map(i => (
                          <div key={i} className="w-0.5 bg-theme-light rounded-full animate-pulse"
                            style={{ height: `${8 + (i % 3) * 4}px`, animationDelay: `${i * 0.1}s`, animationDuration: '0.8s' }} />
                        ))}
                      </div>
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Reasoning...</span>
                 </div>
              </div>
            )}
          </div>

          <div className="p-8 border-t shadow-[0_-20px_60px_rgba(0,0,0,0.05)] relative transition-all z-10" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            {selectedFiles.length > 0 && (
              <div className="mb-6 flex flex-wrap gap-3 animate-in slide-in-from-bottom-2 duration-300">
                {selectedFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-3 px-4 py-2.5 border border-theme/20 rounded-2xl shadow-sm group" style={{ backgroundColor: 'color-mix(in srgb, var(--theme-primary) 5%, var(--bg-secondary))' }}>
                    {file.type.startsWith('image/') ? (
                      <img src={`data:${file.type};base64,${file.data}`} className="w-10 h-10 object-cover rounded-lg shadow-sm" style={{ borderColor: 'var(--border-color)' }} />
                    ) : (
                      <span style={{ color: 'var(--text-tertiary)' }}>{getFileIcon(file.type)}</span>
                    )}
                    <div className="flex flex-col"><span className="text-[11px] font-black text-theme truncate max-w-[150px]">{file.name}</span><span className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-tertiary)' }}>Asset Prepared</span></div>
                    <button onClick={() => removeFile(idx)} className="p-1 rounded-full shadow-sm ml-1 hover:rotate-90 transition-all hover:text-rose-500" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}><svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg></button>
                  </div>
                ))}
              </div>
            )}
            
            <div className="flex gap-5 items-end">
              <div className="flex-1 relative flex items-center rounded-[2.5rem] focus-within:ring-4 focus-within:ring-theme/10 transition-all group/input overflow-hidden" style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' }}>
                <div className="flex items-center gap-2 pl-4 py-4 shrink-0 self-end">
                  <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUpload} accept="image/*,application/pdf,audio/*" />
                  <button onClick={() => fileInputRef.current?.click()} aria-label="上传文档或图片" className="w-12 h-12 rounded-[1.2rem] transition-all flex items-center justify-center shadow-sm border hover:bg-theme hover:text-white" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', borderColor: 'var(--border-color)' }} title="上传文档/图片"><svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg></button>
                  <button onClick={isRecording ? stopRecording : startRecording} aria-label={isRecording ? "停止录音" : "开始语音咨询"} className={`w-12 h-12 rounded-[1.2rem] transition-all flex items-center justify-center shadow-sm border relative ${isRecording ? 'bg-rose-600 text-white animate-pulse border-rose-500 shadow-rose-500/20' : ''}`} style={!isRecording ? { backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', borderColor: 'var(--border-color)' } : undefined} title={isRecording ? "停止录音" : "开始语音咨询"}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                    {isRecording && (<span className="absolute -top-1 -right-1 text-rose-600 text-[10px] font-black px-1.5 py-0.5 rounded-full border border-rose-500" style={{ backgroundColor: 'var(--bg-secondary)' }}>{Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}</span>)}
                  </button>
                </div>
                <textarea 
                  value={input} 
                  onChange={(e) => setInput(e.target.value)} 
                  onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} 
                  style={{ fontSize: `${fontSize}px`, color: 'var(--text-primary)' }}
                  placeholder={isRecording ? "正在倾听您的设计意图..." : "输入逻辑方案、询问建议或进行文档分析..."} 
                  className="w-full bg-transparent pl-6 pr-12 py-7 min-h-[72px] max-h-[350px] resize-none outline-none font-medium leading-relaxed custom-scrollbar" 
                />
                {input && (
                  <button 
                    onClick={() => setInput('')}
                    className="absolute top-4 right-5 w-6 h-6 flex items-center justify-center rounded-full transition-all z-20 group-hover/input:opacity-100 opacity-40 shadow-sm hover:text-rose-500"
                    style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                    title="清空输入内容"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => handleSend(true)} 
                  aria-label="发送并搜索" 
                  className={`w-14 h-14 rounded-[1.8rem] shadow-xl flex items-center justify-center transition-all active:scale-90 shrink-0 ${isSearching ? 'bg-amber-500 animate-pulse' : 'bg-amber-500 hover:bg-amber-400'}`}
                  title="联网搜索后发送"
                >
                  {isSearching 
                    ? <svg className="w-5 h-5 text-white animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    : <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                  }
                </button>
                <button onClick={() => handleSend(false)} aria-label={isLoading ? "停止生成" : "发送消息"} className="w-16 h-16 bg-theme text-white rounded-[2rem] shadow-2xl flex items-center justify-center transition-all active:scale-90 group/send shrink-0">
                  {isLoading
                    ? <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                    : <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 translate-x-0.5 group-hover/send:translate-x-1 group-hover/send:-translate-y-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                  }
                </button>
              </div>
            </div>
            <div className="mt-4 flex justify-center"><p className="text-[9px] font-black text-slate-500 dark:text-slate-600 uppercase tracking-[0.4em] select-none">Powered by KbitAi-Pro Architecture Logic</p></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatBot;
