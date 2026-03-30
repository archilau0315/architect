
import React, { useState, useEffect } from 'react';
import { VersionRecord, CustomModel } from '../types.ts';

interface SystemSpecProps {
  versionHistory: VersionRecord[];
  currentPresets: any;
  onRollback: (version: VersionRecord) => void;
  onUpdate: (newPresets: any, note: string) => void;
  models?: CustomModel[];
  onModelsChange?: (models: CustomModel[]) => void;
  activeModelId?: string;
  onActiveModelChange?: (id: string) => void;
}

const SystemSpec: React.FC<SystemSpecProps> = ({ versionHistory, currentPresets, onRollback, onUpdate, models = [], onModelsChange, activeModelId, onActiveModelChange }) => {
  const [activeVersion, setActiveVersion] = useState<VersionRecord | null>(versionHistory[0] || null);
  const [isEditing, setIsEditing] = useState(false);
  const [editPresets, setEditPresets] = useState({ ...currentPresets });
  const [changeNote, setChangeNote] = useState('');

  // 深度监听 currentPresets，确保编辑器始终同步
  useEffect(() => {
    setEditPresets({ ...currentPresets });
  }, [currentPresets]);

  useEffect(() => {
    setActiveVersion(versionHistory[0]);
  }, [versionHistory]);

  const handleSave = () => {
    if (!changeNote.trim()) {
      alert("请填写本次变更的摘要，以便版本溯源。");
      return;
    }
    // 提交全量预设
    onUpdate({ ...editPresets }, changeNote);
    setIsEditing(false);
    setChangeNote('');
    alert("系统指令已成功更新并同步至内核。");
  };

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-700 w-full mx-auto">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-8 border-b border-slate-200 dark:border-slate-800 pb-10">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-theme/10 border border-theme/20">
            <span className="w-1.5 h-1.5 rounded-full bg-theme animate-pulse" />
            <span className="text-[10px] font-black text-theme uppercase tracking-widest">System Constitution v1.21</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white italic">系统指令技术规范</h1>
          <p className="text-slate-500 text-sm">部署版本: {versionHistory[0]?.version} | 开发者专属管控面板</p>
        </div>
        <div className="flex gap-4">
          <button onClick={() => { setIsEditing(!isEditing); setEditPresets({ ...currentPresets }); }} className={`px-8 py-4 rounded-[2rem] text-[11px] font-black uppercase tracking-widest transition-all shadow-xl ${isEditing ? 'bg-rose-500 text-white shadow-rose-500/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
            {isEditing ? '退出编辑' : '进入配置模式'}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-4 space-y-6">
          <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest pl-4 border-l-2 border-theme">版本审计日志</h3>
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
            {versionHistory.map((v, i) => (
              <div key={i} className={`p-5 rounded-3xl border transition-all ${activeVersion?.version === v.version ? 'bg-theme border-theme text-white shadow-xl' : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800'}`}>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-mono font-black text-lg">{v.version}</span>
                  <span className="text-[9px] opacity-60 font-bold">{new Date(v.timestamp).toLocaleDateString()}</span>
                </div>
                <p className="text-[11px] leading-relaxed mb-4 opacity-80">{v.description}</p>
                {activeVersion?.version !== v.version && (
                  <button onClick={() => onRollback(v)} className="w-full py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">回滚至此版本</button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-8">
          {isEditing ? (
            <div className="bg-white dark:bg-slate-900 border-2 border-theme/30 rounded-[3rem] p-10 space-y-8 animate-in zoom-in-95 duration-300 shadow-2xl">
              <h3 className="text-xl font-black text-slate-900 dark:text-white italic uppercase tracking-widest">指令实时编辑器</h3>
              <div className="grid gap-8">
                {Object.keys(editPresets).map(key => (
                  <div key={key} className="space-y-3">
                    <label className="text-[10px] font-black text-theme-light uppercase tracking-widest ml-1">{key} MODULE</label>
                    <textarea 
                      value={(editPresets as any)[key]} 
                      onChange={(e) => setEditPresets({...editPresets, [key]: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-sm text-slate-700 dark:text-slate-300 font-mono leading-relaxed min-h-[160px] focus:ring-2 focus:ring-theme/30 outline-none"
                    />
                  </div>
                ))}
              </div>
              <div className="pt-8 border-t border-slate-100 dark:border-slate-800 space-y-4">
                 <input 
                  type="text" 
                  value={changeNote} 
                  onChange={(e) => setChangeNote(e.target.value)}
                  placeholder="请输入变更说明摘要..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-6 py-4 text-sm"
                 />
                 <button onClick={handleSave} className="w-full py-5 bg-theme text-white rounded-2xl font-black text-[12px] uppercase tracking-widest shadow-xl hover:bg-theme-light transition-all active:scale-95">提交核心指令并更新内核</button>
              </div>
            </div>
          ) : (
            <div className="bg-theme/5 border border-theme/10 rounded-[3.5rem] p-10 space-y-10">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight pb-8 border-b border-theme/10">Active Constitution: {activeVersion?.version}</h3>
              <div className="grid gap-12">
                 {[
                   { id: 'IMAGE_ENGINE', title: '一、 核心渲染引擎规范' },
                   { id: 'PROMPT_SPECIALIST', title: '二、 架构指令增强规范' },
                   { id: 'VISUAL_ANALYST', title: '三、 视觉基因分析规范' },
                   { id: 'CREATIVE_CONSULTANT', title: '四、 首席顾问咨询规范' }
                 ].map(sec => (
                   <div key={sec.id} className="space-y-5">
                      <h4 className="text-[12px] font-black text-theme dark:text-theme-light uppercase tracking-widest">{sec.title}</h4>
                      <div className="bg-white/40 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-8 shadow-inner">
                        <p className="text-[13px] leading-relaxed font-mono text-slate-600 dark:text-slate-400 whitespace-pre-wrap italic">
                          {(activeVersion?.presets || currentPresets)[sec.id]}
                        </p>
                      </div>
                   </div>
                 ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 模型实例管理 */}
      {onModelsChange && (
        <div className="mt-12 pt-12 border-t border-slate-200 dark:border-slate-800">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white italic">多源模型实例配置</h3>
              <p className="text-slate-500 text-sm mt-1">添加和管理自定义 AI 模型实例</p>
            </div>
            <button 
              onClick={() => onModelsChange([...models, { id: 'custom-'+Date.now(), name: '', modelId: '', isOfficial: false, baseUrl: '', apiKey: '' }])} 
              className="px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-slate-100 transition-all"
            >
              + 新增模型
            </button>
          </div>
          
          {models.filter(m => !m.isOfficial).length === 0 ? (
            <div className="text-center py-12 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700">
              <p className="text-slate-400 text-sm">暂无自定义模型，点击上方按钮添加</p>
            </div>
          ) : (
            <div className="grid gap-6">
              {models.filter(m => !m.isOfficial).map((m, i) => (
                <div key={m.id} className={`p-8 rounded-[2rem] border transition-all space-y-6 relative ${activeModelId === m.id ? 'bg-theme/5 border-theme shadow-xl' : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-white/5'}`}>
                  <button 
                    onClick={() => onModelsChange(models.filter(mod => mod.id !== m.id))}
                    className="absolute top-6 right-6 w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500 hover:text-rose-500 flex items-center justify-center transition-all z-10"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4 flex-1">
                      {onActiveModelChange && (
                        <button onClick={() => onActiveModelChange(m.id)} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${activeModelId === m.id ? 'border-theme bg-theme' : 'border-slate-300'}`}>
                          {activeModelId === m.id && <div className="w-2 h-2 bg-white rounded-full" />}
                        </button>
                      )}
                      <input 
                        value={m.name} 
                        onChange={(e) => { const n = [...models]; n[models.indexOf(m)].name = e.target.value; onModelsChange(n); }} 
                        placeholder="实例名称" 
                        className="bg-transparent text-lg font-black italic outline-none flex-1" 
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Model ID</label>
                      <input 
                        value={m.modelId} 
                        onChange={(e) => { const n = [...models]; n[models.indexOf(m)].modelId = e.target.value; onModelsChange(n); }} 
                        placeholder="e.g. gemini-2.5-pro" 
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm outline-none" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Base URL</label>
                      <input 
                        value={m.baseUrl || ''} 
                        onChange={(e) => { const n = [...models]; n[models.indexOf(m)].baseUrl = e.target.value; onModelsChange(n); }} 
                        placeholder="https://api.example.com" 
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm outline-none" 
                      />
                    </div>

                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SystemSpec;
