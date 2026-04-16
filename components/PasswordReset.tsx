import React, { useState, useEffect } from 'react';

interface PasswordResetProps {
  onBack: () => void;
}

const PasswordReset: React.FC<PasswordResetProps> = ({ onBack }) => {
  const [step, setStep] = useState<'email' | 'verify' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token') || urlParams.get('reset');
    if (urlToken) {
      setToken(urlToken);
      verifyToken(urlToken);
    }
  }, []);

  const apiBase = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001' : '';

  const verifyToken = async (tokenToVerify: string) => {
    try {
      const response = await fetch(`${apiBase}/api/auth/verify-reset-token?token=${tokenToVerify}`);
      const data = await response.json();
      
      if (data.success) {
        setEmail(data.email);
        setStep('reset');
      } else {
        setError('重置链接已过期或无效');
        setStep('email');
      }
    } catch (err) {
      setError('验证失败，请重试');
      setStep('email');
    }
  };

  const handleRequestReset = async () => {
    if (!email) {
      setError('请输入邮箱地址');
      return;
    }

    if (!email.includes('@')) {
      setError('请输入有效的邮箱地址');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${apiBase}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('重置请求已提交，请联系管理员获取重置链接');
        setStep('verify');
      } else {
        setError(data.error || '请求失败');
      }
    } catch (err) {
      setError('网络错误，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      setError('请填写所有字段');
      return;
    }

    if (newPassword.length < 6) {
      setError('密码长度至少6位');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${apiBase}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('密码重置成功！即将返回登录页面...');
        setTimeout(() => {
          onBack();
        }, 2000);
      } else {
        setError(data.error || '重置失败');
      }
    } catch (err) {
      setError('网络错误，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const InputField = ({ 
    label, 
    type, 
    value, 
    onChange, 
    placeholder, 
    id,
    showToggle = false,
    toggleState,
    onToggle 
  }: { 
    label: string; 
    type: string; 
    value: string; 
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; 
    placeholder: string;
    id: string;
    showToggle?: boolean;
    toggleState?: boolean;
    onToggle?: () => void;
  }) => (
    <div className="relative">
      <input
        id={id}
        type={showToggle ? (toggleState ? 'text' : type) : type}
        value={value}
        onChange={onChange}
        placeholder=" "
        className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none transition-all duration-300"
        style={{
          borderColor: focusedField === id ? 'rgba(99, 102, 241, 0.5)' : 'rgba(255, 255, 255, 0.1)',
          boxShadow: focusedField === id ? '0 0 0 2px rgba(99, 102, 241, 0.15)' : 'none'
        }}
        onFocus={() => setFocusedField(id)}
        onBlur={() => setFocusedField(null)}
      />
      <label 
        htmlFor={id}
        className="absolute left-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-indigo-300 uppercase tracking-widest pointer-events-none transition-all duration-300"
        style={{
          transform: focusedField === id || value ? 'translate(-10px, -28px) scale(0.85)' : 'translateY(-50%)',
          opacity: focusedField === id || value ? 1 : 0.6
        }}
      >
        {label}
      </label>
      <span 
        className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-500 text-sm pointer-events-none transition-all duration-300"
        style={{
          opacity: focusedField === id || value ? 0 : 1
        }}
      >
        {placeholder}
      </span>
      {showToggle && onToggle && (
        <button 
          type="button" 
          onClick={onToggle}
          className="absolute right-6 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
        >
          {toggleState
            ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
          }
        </button>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-[pulse_4s_ease-in-out_infinite]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-[pulse_4s_ease-in-out_infinite_1s]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-10 animate-[fadeInUp_0.6s_ease-out]">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-3xl shadow-2xl shadow-indigo-500/30 mb-6 overflow-hidden transition-transform duration-300 hover:scale-105">
            <img src="/architect/archi01.png" alt="KBITAI" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-3xl font-black text-white italic tracking-wide mb-2 px-1">
            KBITAI <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Architect</span>
          </h1>
          <p className="text-indigo-300/60 text-sm font-medium tracking-widest uppercase">
            首席图像架构师 · 内测版
          </p>
        </div>

        <div 
          className="bg-white/5 backdrop-blur-xl rounded-[3rem] p-10 border border-white/10 shadow-2xl transition-all duration-500 hover:shadow-indigo-500/10"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)'
          }}
        >
          {step === 'email' && (
            <>
              <div className="text-center mb-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-xl font-black text-white mb-2">忘记密码</h2>
                <p className="text-slate-400 text-sm">请输入您的邮箱地址，我们将发送重置链接</p>
              </div>

              <div className="space-y-5">
                <InputField
                  label="邮箱地址"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  id="reset-email"
                />

                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl animate-[fadeIn_0.3s_ease-out]">
                    <p className="text-red-400 text-sm text-center">{error}</p>
                  </div>
                )}

                <button
                  onClick={handleRequestReset}
                  disabled={isLoading}
                  className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-2xl font-black text-sm uppercase tracking-wider transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98]"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      发送中...
                    </span>
                  ) : (
                    '发送重置链接'
                  )}
                </button>
              </div>

              <button
                onClick={onBack}
                className="w-full mt-6 text-slate-500 text-sm hover:text-white transition-colors duration-200"
              >
                ← 返回登录
              </button>
            </>
          )}

          {step === 'verify' && (
            <>
              <div className="text-center mb-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-green-500/20 to-emerald-500/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-xl font-black text-white mb-2">请查收邮件</h2>
                <p className="text-slate-400 text-sm">
                  我们已向 <span className="text-indigo-400">{email}</span> 发送了密码重置链接
                </p>
              </div>

              {success && (
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-2xl mb-6 animate-[fadeIn_0.3s_ease-out]">
                  <p className="text-green-400 text-sm text-center">{success}</p>
                </div>
              )}

              <div className="space-y-4">
                <p className="text-slate-500 text-xs text-center">
                  如果没有收到邮件，请检查垃圾邮件文件夹或重试
                </p>

                <button
                  onClick={() => setStep('email')}
                  className="w-full py-4 bg-white/5 border border-white/10 text-white rounded-2xl font-black text-sm uppercase tracking-wider hover:bg-white/10 transition-all duration-300"
                >
                  重新发送
                </button>
              </div>

              <button
                onClick={onBack}
                className="w-full mt-6 text-slate-500 text-sm hover:text-white transition-colors duration-200"
              >
                ← 返回登录
              </button>
            </>
          )}

          {step === 'reset' && (
            <>
              <div className="text-center mb-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <h2 className="text-xl font-black text-white mb-2">设置新密码</h2>
                <p className="text-slate-400 text-sm">请输入您的新密码</p>
              </div>

              <div className="space-y-4">
                <InputField
                  label="新密码"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  id="reset-new-password"
                  showToggle={true}
                  toggleState={showPassword}
                  onToggle={() => setShowPassword(p => !p)}
                />

                <InputField
                  label="确认密码"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  id="reset-confirm-password"
                />

                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl animate-[fadeIn_0.3s_ease-out]">
                    <p className="text-red-400 text-sm text-center">{error}</p>
                  </div>
                )}

                {success && (
                  <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-2xl animate-[fadeIn_0.3s_ease-out]">
                    <p className="text-green-400 text-sm text-center">{success}</p>
                  </div>
                )}

                <button
                  onClick={handleResetPassword}
                  disabled={isLoading}
                  className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-2xl font-black text-sm uppercase tracking-wider transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98]"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      重置中...
                    </span>
                  ) : (
                    '重置密码'
                  )}
                </button>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          本应用仅限邀请注册、内部试用，不向公众提供服务
        </p>
      </div>
    </div>
  );
};

export default PasswordReset;