import React, { useState } from 'react';
import { TERMS_OF_SERVICE } from '../legal/termsOfService.ts';
import { PRIVACY_POLICY } from '../legal/privacyPolicy.ts';

interface BetaApplicationBannerProps {
  onClose: () => void;
}

const BetaApplicationBanner: React.FC<BetaApplicationBannerProps> = ({ onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    purpose: '',
    experience: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [showAgreement, setShowAgreement] = useState<'terms' | 'privacy' | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      const response = await fetch('/api/beta/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          appliedAt: new Date().toISOString()
        })
      });

      if (response.ok) {
        setSubmitStatus('success');
        localStorage.setItem('architect-beta-application-submitted', 'true');
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        // 后端返回错误
        const errorData = await response.json().catch(() => ({ error: '服务器错误' }));
        setSubmitStatus('error');
        alert('申请失败：' + (errorData.error || '请稍后重试'));
      }
    } catch (error) {
      console.error('Beta application error:', error);
      setSubmitStatus('error');
      alert('申请失败：网络错误，请稍后重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-[pulse_4s_ease-in-out_infinite]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-[pulse_4s_ease-in-out_infinite_1s]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-3xl" />
      </div>
      
      <div 
        className="relative w-full max-w-lg bg-white/5 backdrop-blur-xl rounded-[3rem] p-10 border border-white/10 shadow-2xl transition-all duration-500 hover:shadow-indigo-500/10"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)'
        }}
      >
        <button 
          onClick={handleClose}
          className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center bg-white/5 border border-white/10 rounded-full text-white/60 hover:bg-white/10 hover:text-white transition-all"
        >
          ✕
        </button>

        <div className="text-center mb-8">
          <span className="inline-block px-4 py-1.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full text-[10px] font-black text-white uppercase tracking-widest mb-4">
            内测申请
          </span>
          <h2 className="text-2xl font-black text-white italic">
            申请加入 KBITAI 内测
          </h2>
          <p className="text-sm text-slate-400 mt-2">
            填写以下信息，我们将尽快审核您的申请
          </p>
        </div>

        {showAgreement && (
          <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" onClick={() => setShowAgreement(null)}>
            <div 
              className="relative w-full max-w-2xl max-h-[80vh] bg-white/5 backdrop-blur-xl rounded-[2rem] border border-white/10 shadow-2xl animate-[fadeInUp_0.3s_ease-out]"
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={() => setShowAgreement(null)}
                className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center bg-white/5 border border-white/10 rounded-full text-white/60 hover:bg-white/10 hover:text-white transition-all"
              >
                ✕
              </button>
              <div className="p-6">
                <h3 className="text-lg font-black text-white mb-4 text-center">
                  {showAgreement === 'terms' ? '用户服务协议' : '隐私保护政策'}
                </h3>
                <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                  <pre className="text-sm text-white/60 whitespace-pre-wrap bg-white/[0.02] border border-white/[0.06] p-5 rounded-xl">
                    {showAgreement === 'terms' ? TERMS_OF_SERVICE : PRIVACY_POLICY}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {submitStatus === 'success' ? (
          <div className="text-center py-10">
            <div className="w-20 h-20 mx-auto mb-6 bg-green-500/20 rounded-full flex items-center justify-center">
              <span className="text-4xl">✅</span>
            </div>
            <h3 className="text-xl font-black text-green-400 mb-2">
              申请提交成功！
            </h3>
            <p className="text-sm text-slate-400">
              感谢您的申请，我们将在 1-3 个工作日内完成审核
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">
                  姓名 <span className="text-red-400">*</span>
                </label>
                <input 
                  type="text" 
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-5 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm font-medium text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-500"
                  placeholder="您的姓名"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">
                  邮箱 <span className="text-red-400">*</span>
                </label>
                <input 
                  type="email" 
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-5 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm font-medium text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-500"
                  placeholder="your@email.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">
                  电话
                </label>
                <input 
                  type="tel" 
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full px-5 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm font-medium text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-500"
                  placeholder="手机号码"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">
                  公司/机构
                </label>
                <input 
                  type="text" 
                  value={formData.company}
                  onChange={(e) => setFormData({...formData, company: e.target.value})}
                  className="w-full px-5 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm font-medium text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-500"
                  placeholder="公司名称"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">
                使用场景 <span className="text-red-400">*</span>
              </label>
              <select 
                required
                value={formData.purpose}
                onChange={(e) => setFormData({...formData, purpose: e.target.value})}
                className="w-full px-5 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm font-medium text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none cursor-pointer"
              >
                <option value="" className="bg-slate-900">请选择使用场景</option>
                <option value="architecture" className="bg-slate-900">建筑可视化设计</option>
                <option value="product" className="bg-slate-900">产品设计</option>
                <option value="education" className="bg-slate-900">教育培训</option>
                <option value="research" className="bg-slate-900">科研研究</option>
                <option value="entertainment" className="bg-slate-900">娱乐创作</option>
                <option value="other" className="bg-slate-900">其他</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">
                AI 使用经验
              </label>
              <select 
                value={formData.experience}
                onChange={(e) => setFormData({...formData, experience: e.target.value})}
                className="w-full px-5 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm font-medium text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none cursor-pointer"
              >
                <option value="" className="bg-slate-900">请选择</option>
                <option value="none" className="bg-slate-900">无经验</option>
                <option value="beginner" className="bg-slate-900">少量使用</option>
                <option value="intermediate" className="bg-slate-900">有经验</option>
                <option value="expert" className="bg-slate-900">资深用户</option>
              </select>
            </div>

            {submitStatus === 'error' && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                <p className="text-sm text-red-400">
                  提交失败，请稍后重试或联系管理员
                </p>
              </div>
            )}

            <button 
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-2xl font-black text-sm uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98]"
            >
              {isSubmitting ? '提交中...' : '提交申请'}
            </button>

            <p className="text-center text-[10px] text-slate-500">
              提交即表示同意我们的 
              <button 
                onClick={() => setShowAgreement('terms')}
                className="text-indigo-400 hover:text-indigo-300 hover:underline transition-colors duration-200 cursor-pointer"
              >服务条款</button> 
              和 
              <button 
                onClick={() => setShowAgreement('privacy')}
                className="text-indigo-400 hover:text-indigo-300 hover:underline transition-colors duration-200 cursor-pointer"
              >隐私政策</button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
};

export default BetaApplicationBanner;
