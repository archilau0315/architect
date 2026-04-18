import React, { useState, useEffect, useCallback } from 'react';
import InputField from './InputField.tsx';

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
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState<0 | 1 | 2 | 3>(0);

  const handleFocus = useCallback((id: string) => {
    setFocusedField(id);
  }, []);

  const handleBlur = useCallback(() => {
    setFocusedField(null);
  }, []);

  const validateEmail = (emailVal: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailVal) {
      setEmailError('');
      return false;
    }
    if (!emailVal.includes('@')) {
      setEmailError('请输入包含@的邮箱地址');
      return false;
    }
    if (!emailRegex.test(emailVal)) {
      setEmailError('请输入有效的邮箱格式');
      return false;
    }
    setEmailError('');
    return true;
  };

  const validateNewPassword = (password: string) => {
    if (!password) {
      setPasswordError('');
      setPasswordStrength(0);
      return false;
    }
    
    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 10) strength++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    
    const finalStrength = Math.min(strength, 3) as 0 | 1 | 2 | 3;
    setPasswordStrength(finalStrength);
    
    if (password.length < 6) {
      setPasswordError('密码长度至少需要6位');
      return false;
    }
    setPasswordError('');
    return true;
  };

  const validateConfirmPassword = (confirm: string) => {
    if (!confirm) {
      setConfirmError('');
      return false;
    }
    if (confirm !== newPassword) {
      setConfirmError('两次输入的密码不一致');
      return false;
    }
    setConfirmError('');
    return true;
  };

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
                  onChange={(value) => {
                    setEmail(value);
                    setError('');
                  }}
                  placeholder="xxx@email.com"
                  id="reset-email"
                  isFocused={focusedField === 'reset-email'}
                  hasError={!!emailError}
                  hasSuccess={!!(email && !emailError && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))}
                  errorMessage={emailError}
                  onFocus={() => handleFocus('reset-email')}
                  onBlur={() => {
                    handleBlur();
                    validateEmail(email);
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleRequestReset(); }}
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
                  onClick={() => { setStep('email'); setSuccess(''); }}
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
                  onChange={(value) => {
                    setNewPassword(value);
                    validateNewPassword(value);
                    setError('');
                  }}
                  placeholder="设置新密码"
                  id="reset-new-password"
                  showToggle={true}
                  toggleState={showPassword}
                  onToggle={() => setShowPassword(p => !p)}
                  isFocused={focusedField === 'reset-new-password'}
                  hasError={!!passwordError}
                  errorMessage={passwordError}
                  onFocus={() => handleFocus('reset-new-password')}
                  onBlur={handleBlur}
                />
                {newPassword && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">
                        密码强度
                      </span>
                      <span className={`text-[10px] font-medium ${
                        passwordStrength === 1 ? 'text-red-400' :
                        passwordStrength === 2 ? 'text-amber-400' :
                        passwordStrength === 3 ? 'text-green-400' : 'text-slate-500'
                      }`}>
                        {passwordStrength === 1 ? '弱' : passwordStrength === 2 ? '中等' : passwordStrength === 3 ? '强' : '-'}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      {[1, 2, 3].map((level) => (
                        <div
                          key={level}
                          className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                            level <= passwordStrength
                              ? passwordStrength === 1 ? 'bg-red-500' :
                                passwordStrength === 2 ? 'bg-amber-500' : 'bg-green-500'
                              : 'bg-white/10'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <InputField
                  label="确认密码"
                  type="password"
                  value={confirmPassword}
                  onChange={(value) => {
                    setConfirmPassword(value);
                    validateConfirmPassword(value);
                    setError('');
                  }}
                  placeholder="再次输入密码"
                  id="reset-confirm-password"
                  showToggle={true}
                  toggleState={showPassword}
                  onToggle={() => setShowPassword(p => !p)}
                  isFocused={focusedField === 'reset-confirm-password'}
                  hasError={!!confirmError}
                  errorMessage={confirmError}
                  onFocus={() => handleFocus('reset-confirm-password')}
                  onBlur={handleBlur}
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