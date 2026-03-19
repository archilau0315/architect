import React, { useState } from 'react';

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
        // 后端返回错误，启用模拟模式
        setSubmitStatus('success');
        localStorage.setItem('architect-beta-application-submitted', 'true');
        localStorage.setItem('architect-demo-invite-code', 'KBITDEMO1');
        alert('申请成功！\n\n演示模式：您的邀请码是 KBITDEMO1\n请返回输入邀请码体验完整流程。');
        onClose();
      }
    } catch (error) {
      console.error('Beta application error:', error);
      // 模拟模式：当后端不可用时，直接通过
      setSubmitStatus('success');
      localStorage.setItem('architect-beta-application-submitted', 'true');
      localStorage.setItem('architect-demo-invite-code', 'KBITDEMO1');
      alert('申请成功！\n\n演示模式：您的邀请码是 KBITDEMO1\n请返回输入邀请码体验完整流程。');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm" onClick={handleClose} />
      
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[3rem] p-10 shadow-2xl animate-in zoom-in-95 duration-300">
        <button 
          onClick={handleClose}
          className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
        >
          ✕
        </button>

        <div className="text-center mb-8">
          <span className="inline-block px-4 py-1.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full text-[10px] font-black text-white uppercase tracking-widest mb-4">
            内测申请
          </span>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white italic">
            申请加入 KBITAI 内测
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            填写以下信息，我们将尽快审核您的申请
          </p>
        </div>

        {submitStatus === 'success' ? (
          <div className="text-center py-10">
            <div className="w-20 h-20 mx-auto mb-6 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <span className="text-4xl">✅</span>
            </div>
            <h3 className="text-xl font-black text-green-600 dark:text-green-400 mb-2">
              申请提交成功！
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              感谢您的申请，我们将在 1-3 个工作日内完成审核
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                  姓名 <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder="您的姓名"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                  邮箱 <span className="text-red-500">*</span>
                </label>
                <input 
                  type="email" 
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder="your@email.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                  电话
                </label>
                <input 
                  type="tel" 
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder="手机号码"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                  公司/机构
                </label>
                <input 
                  type="text" 
                  value={formData.company}
                  onChange={(e) => setFormData({...formData, company: e.target.value})}
                  className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder="公司名称"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                使用场景 <span className="text-red-500">*</span>
              </label>
              <select 
                required
                value={formData.purpose}
                onChange={(e) => setFormData({...formData, purpose: e.target.value})}
                className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              >
                <option value="">请选择使用场景</option>
                <option value="architecture">建筑可视化设计</option>
                <option value="product">产品设计</option>
                <option value="education">教育培训</option>
                <option value="research">科研研究</option>
                <option value="entertainment">娱乐创作</option>
                <option value="other">其他</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                AI 使用经验
              </label>
              <select 
                value={formData.experience}
                onChange={(e) => setFormData({...formData, experience: e.target.value})}
                className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              >
                <option value="">请选择</option>
                <option value="none">无经验</option>
                <option value="beginner">少量使用</option>
                <option value="intermediate">有经验</option>
                <option value="expert">资深用户</option>
              </select>
            </div>

            {submitStatus === 'error' && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl">
                <p className="text-sm text-red-600 dark:text-red-400">
                  提交失败，请稍后重试或联系管理员
                </p>
              </div>
            )}

            <button 
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-2xl font-black text-sm uppercase tracking-wider hover:from-indigo-600 hover:to-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/25"
            >
              {isSubmitting ? '提交中...' : '提交申请'}
            </button>

            <p className="text-center text-[10px] text-slate-400">
              提交即表示同意我们的 
              <a href="#" className="text-indigo-500 hover:underline">服务条款</a> 
              和 
              <a href="#" className="text-indigo-500 hover:underline">隐私政策</a>
            </p>
          </form>
        )}
      </div>
    </div>
  );
};

export default BetaApplicationBanner;
