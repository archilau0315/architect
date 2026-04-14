
import React, { useState, useRef, useEffect } from 'react';
import { GeminiService, DEFAULT_SYSTEM_PRESETS } from '../services/geminiService.ts';
import { ChatMessage, CustomModel, ChatSession, ExtendedChatMessage } from '../types.ts';
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

  // 计算对话成本
  const handleSend = async () => {
    if (isLoading) {
      abortControllerRef.current?.abort();
      setIsLoading(false);
      onBusyStateChange?.(false);
      return;
    }

    if ((!input.trim() && selectedFiles.length === 0)) return;

    let activeSessionId = currentSessionId;
    let nextSessions = [...sessions];

    // 如果没有会话，创建一个
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
    onBusyStateChange?.(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const targetSession = nextSessions.find(s => s.id === activeSessionId)!;
      // Sliding Window: Only send the last 8 messages to the API to save tokens
      const contextMessages = targetSession.messages.slice(-8);
      const historyForAPI = contextMessages.map(m => ({ role: m.role, parts: m.parts || [{ text: m.text }] }));
      
      const result = await GeminiService.chat(userPrompt, historyForAPI, thinkingMode, currentFiles, instructions, modelConfig, controller.signal);
      
      const contentId = ContentIdService.generateId();
      
      const userMsg: ExtendedChatMessage = { role: 'user', text: userPrompt, parts: result.partsSent, timestamp: Date.now() };
      const modelMsg: ExtendedChatMessage = { role: 'model', text: result.text, sources: result.sources, timestamp: Date.now(), contentId };
      
      const updatedMessages = [...targetSession.messages, userMsg, modelMsg];
      
      // 自动标题逻辑：首条消息提取
      let updatedTitle = targetSession.title;
      if (targetSession.messages.length === 0) {
        updatedTitle = userPrompt.length > 15 ? userPrompt.substring(0, 15) + '...' : userPrompt;
      }

      const updatedSessions = nextSessions.map(s => s.id === activeSessionId ? { ...s, title: updatedTitle, messages: updatedMessages, timestamp: Date.now() } : s);
      updateSessionsAndStore(updatedSessions);
      
      // 获取用户ID
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
      
      // 获取真实的费用并扣除积分
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

            // 用真实费用扣除积分（利润10倍：用户积分 = cost ÷ 10，向上取整）
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
        onBusyStateChange?.(false);
      }
    }
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopyStatus(index);
    setTimeout(() => setCopyStatus(null), 2000);
  };

  const getFileIcon = (type: string) => {
    if (type.includes('image')) return '🖼️';
    if (type.includes('pdf')) return '📄';
    if (type.includes('audio')) return '🎙️';
    return '📦';
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
        
        <div className={`absolute top-0 left-0 z-[60] h-full w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-2xl transform transition-transform duration-500 ease-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
           <div className="p-6 border-b border-slate-200 dark:border-slate-800/60 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest">历史对话</span>
                <div className="flex gap-2">
                  <button onClick={createNewChat} className="w-8 h-8 rounded-lg bg-theme text-white flex items-center justify-center hover:bg-theme-light transition-all active:scale-95 shadow-lg shadow-theme" title="开启新对话">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                  </button>
                  <button onClick={() => setIsSidebarOpen(false)} className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center hover:text-rose-500 transition-all">
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
                  className="w-full bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-[11px] font-medium outline-none focus:ring-2 focus:ring-theme/20 transition-all"
                />
                <svg xmlns="http://www.w3.org/2000/svg" className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
           </div>
           <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              {filteredSessions.map(s => (
                <div 
                  key={s.id} 
                  onClick={() => { if(editingSessionId !== s.id) { setCurrentSessionId(s.id); setIsSidebarOpen(false); } }}
                  className={`group flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer transition-all border ${currentSessionId === s.id ? 'bg-theme/5 dark:bg-theme/10 border border-theme/20' : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/40'}`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                     <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 shrink-0 ${currentSessionId === s.id ? 'text-theme' : 'text-slate-500 dark:text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                     {editingSessionId === s.id ? (
                        <input 
                          autoFocus
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onBlur={saveRename}
                          onKeyDown={(e) => e.key === 'Enter' && saveRename()}
                          className="bg-transparent border-none outline-none text-[12px] font-bold text-slate-700 dark:text-slate-200 w-full"
                        />
                     ) : (
                        <span className="text-[12px] font-bold text-slate-700 dark:text-slate-200 truncate">{s.title}</span>
                     )}
                  </div>
                  {editingSessionId !== s.id && (
                    <div className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${currentSessionId === s.id ? 'opacity-100' : ''}`}>
                       <button onClick={(e) => startRename(s.id, s.title, e)} className="p-1 hover:text-theme text-slate-500 dark:text-slate-400"><svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                       <button onClick={(e) => deleteChat(s.id, e)} className="p-1 hover:text-rose-500 text-slate-500 dark:text-slate-400"><svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                    </div>
                  )}
                </div>
              ))}
           </div>
        </div>

        <div className="flex-1 flex flex-col h-full overflow-hidden relative">
          <div className="px-8 py-6 border-b border-slate-200 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/80 flex items-center justify-between z-10">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-500 hover:text-theme transition-all shadow-sm flex items-center gap-2 group"
                title="查看历史对话"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 group-hover:rotate-12 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">会话库</span>
              </button>
              <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-2" />
              <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
              <div>
                <p className="text-[11px] text-slate-600 dark:text-slate-500 font-black uppercase tracking-widest italic">{currentSession?.title || 'Multi-Modal Consultation Engine'}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="flex bg-slate-100 dark:bg-slate-950/60 p-1.5 rounded-2xl gap-1 ring-1 ring-slate-200 dark:ring-white/5 shadow-inner">
                {[{ id: 'FAST', label: '极速', desc: 'Precise' }, { id: 'ADVANCED', label: '逻辑', desc: 'Advanced' }, { id: 'DEEP', label: '深度', desc: 'Deep' }].map(mode => (
                  <button key={mode.id} onClick={() => setThinkingMode(mode.id as any)} className={`px-4 py-2 rounded-xl transition-all duration-300 flex flex-col items-center min-w-[70px] ${thinkingMode === mode.id ? 'bg-theme text-white shadow-xl scale-105' : 'text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
                    <span className="text-[11px] font-black uppercase">{mode.label}</span>
                    <span className="text-[7px] font-bold opacity-60 uppercase">{mode.desc}</span>
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
                        <span style={{ color: '#00008B', fontSize: `${fontSize}px` }}>【人工智能Kbitai生成咨询建议】</span>
                        <span className="text-[9px] text-slate-400 dark:text-slate-500 ml-2 select-all" style={{ fontSize: '9px' }}>
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
                        <p className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest italic flex items-center gap-2">检索信源增强</p>
                        <div className="flex flex-wrap gap-2">{msg.sources.map((source, idx) => (<a key={idx} href={source.uri} target="_blank" rel="noopener noreferrer" className="px-4 py-1.5 bg-slate-50 dark:bg-slate-900 rounded-full text-[10px] text-theme dark:text-theme-light font-black border border-slate-200 dark:border-white/5 hover:bg-theme hover:text-white shadow-sm transition-all">{source.title || 'Source Link'}</a>))}</div>
                      </div>
                    )}
                  </div>
                  <div className={`mt-3 flex items-center gap-5 text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 opacity-0 group-hover:opacity-100 transition-all ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                     <span className="font-mono">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                     <button onClick={() => handleCopy(msg.text, i)} className={`flex items-center gap-1.5 transition-colors ${copyStatus === i ? 'text-emerald-500' : 'hover:text-theme'}`}>{copyStatus === i ? '已复制' : '一键导出'}</button>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="justify-start animate-in slide-in-from-left-4 flex">
                 <div className="bg-slate-100 dark:bg-slate-800 rounded-[1.5rem] rounded-tl-none px-8 py-5 flex items-center gap-5 border border-slate-200 dark:border-slate-700/50 shadow-sm">
                    <div className="flex gap-1.5"><div className="w-2 h-2 bg-theme-light rounded-full animate-bounce" /><div className="w-2 h-2 bg-theme-light rounded-full animate-bounce [animation-delay:0.2s]" /><div className="w-2 h-2 bg-theme-light rounded-full animate-bounce [animation-delay:0.4s]" /></div>
                    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Architect Brain Reasoning...</span>
                 </div>
              </div>
            )}
          </div>

          <div className="p-8 bg-white/90 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 shadow-[0_-20px_60px_rgba(0,0,0,0.05)] relative transition-all z-10">
            {selectedFiles.length > 0 && (
              <div className="mb-6 flex flex-wrap gap-3 animate-in slide-in-from-bottom-2 duration-300">
                {selectedFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-3 px-4 py-2.5 bg-theme/5 dark:bg-theme/10 border border-theme/20 rounded-2xl shadow-sm group">
                    {file.type.startsWith('image/') ? (
                      <img src={`data:${file.type};base64,${file.data}`} className="w-10 h-10 object-cover rounded-lg shadow-sm border border-white/10" />
                    ) : (
                      <span className="text-lg">{getFileIcon(file.type)}</span>
                    )}
                    <div className="flex flex-col"><span className="text-[11px] font-black text-theme dark:text-theme-light truncate max-w-[150px]">{file.name}</span><span className="text-[8px] font-bold text-slate-400 uppercase">Asset Prepared</span></div>
                    <button onClick={() => removeFile(idx)} className="text-slate-300 hover:text-rose-500 p-1 bg-white dark:bg-slate-800 rounded-full shadow-sm ml-1 hover:rotate-90 transition-all"><svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg></button>
                  </div>
                ))}
              </div>
            )}
            
            <div className="flex gap-5 items-end">
              <div className="flex-1 relative flex items-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] focus-within:ring-4 focus-within:ring-theme/10 transition-all group/input overflow-hidden">
                <div className="flex items-center gap-2 pl-4 py-4 shrink-0 self-end">
                  <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUpload} accept="image/*,application/pdf,audio/*" />
                  <button onClick={() => fileInputRef.current?.click()} className="w-12 h-12 bg-white dark:bg-slate-800 hover:bg-theme hover:text-white rounded-[1.2rem] transition-all flex items-center justify-center text-slate-500 dark:text-slate-400 shadow-sm border border-slate-100 dark:border-slate-700" title="上传文档/图片"><svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg></button>
                  <button onClick={isRecording ? stopRecording : startRecording} className={`w-12 h-12 rounded-[1.2rem] transition-all flex items-center justify-center shadow-sm border relative ${isRecording ? 'bg-rose-600 text-white animate-pulse border-rose-500 shadow-rose-500/20' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-emerald-600 hover:text-white border-slate-100 dark:border-slate-700'}`} title={isRecording ? "停止录音" : "开始语音咨询"}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                    {isRecording && (<span className="absolute -top-1 -right-1 bg-white dark:bg-slate-900 text-rose-600 text-[8px] font-black px-1.5 py-0.5 rounded-full border border-rose-500">{Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}</span>)}
                  </button>
                </div>
                <textarea 
                  value={input} 
                  onChange={(e) => setInput(e.target.value)} 
                  onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} 
                  style={{ fontSize: `${fontSize}px` }}
                  placeholder={isRecording ? "正在倾听您的设计意图..." : "输入逻辑方案、询问建议或进行文档分析..."} 
                  className="w-full bg-transparent pl-6 pr-12 py-7 min-h-[72px] max-h-[350px] resize-none outline-none font-medium leading-relaxed custom-scrollbar" 
                />
                {input && (
                  <button 
                    onClick={() => setInput('')}
                    className="absolute top-4 right-5 w-6 h-6 flex items-center justify-center rounded-full bg-slate-200/50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 hover:text-rose-500 transition-all z-20 group-hover/input:opacity-100 opacity-40 shadow-sm"
                    title="清空输入内容"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              <button onClick={handleSend} className="w-16 h-16 bg-theme text-white rounded-[2rem] shadow-2xl flex items-center justify-center transition-all active:scale-90 group/send shrink-0"><svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 translate-x-0.5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg></button>
            </div>
            <div className="mt-4 flex justify-center"><p className="text-[9px] font-black text-slate-500 dark:text-slate-600 uppercase tracking-[0.4em] select-none">Powered by KbitAi-Pro Architecture Logic</p></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatBot;
