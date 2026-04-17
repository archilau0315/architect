import React, { useState, useEffect, useRef, useCallback } from 'react';
import BetaApplicationBanner from './BetaApplicationBanner.tsx';
import PasswordReset from './PasswordReset.tsx';
import InputField from './InputField.tsx';
import { AVATAR_KEY } from '../constants.ts';

interface InviteVerifyProps {
  onVerified: (data: { email: string; tier: string; points: number }) => void;
}

const InviteVerify: React.FC<InviteVerifyProps> = ({ onVerified }) => {
  const [inviteCode, setInviteCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  const [codeStatus, setCodeStatus] = useState<'empty' | 'valid' | 'invalid'>('empty');
  const [showRegister, setShowRegister] = useState(false);
  const [showApplication, setShowApplication] = useState(false);
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [registerData, setRegisterData] = useState({
    email: '',
    password: '',
    nickname: ''
  });
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState<0 | 1 | 2 | 3>(0);
  const [currentView, setCurrentView] = useState<'verify' | 'login' | 'register'>('verify');
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  useEffect(() => {
    const savedUser = localStorage.getItem('architect-invite-session');
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        onVerified(userData);
      } catch (e) {
        localStorage.removeItem('architect-invite-session');
      }
    }
    
    const savedAvatar = localStorage.getItem(AVATAR_KEY);
    if (savedAvatar) {
      setUserAvatar(savedAvatar);
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    const resetToken = urlParams.get('reset');
    if (resetToken) {
      setShowPasswordReset(true);
    }
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === AVATAR_KEY && e.newValue) {
        setUserAvatar(e.newValue);
      }
    };
    
    const handleAvatarEvent = (e: CustomEvent<string>) => {
      setUserAvatar(e.detail);
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('avatarChanged', handleAvatarEvent as EventListener);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('avatarChanged', handleAvatarEvent as EventListener);
    };
  }, [onVerified]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('图片大小不能超过 2MB');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setUserAvatar(result);
        localStorage.setItem(AVATAR_KEY, result);
        window.dispatchEvent(new CustomEvent('avatarChanged', { detail: result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleVerify = async () => {
    if (!inviteCode.trim()) {
      setError('请输入邀请码');
      return;
    }

    setIsVerifying(true);
    setError('');

    const demoCodes = ['KBITDEMO1', 'KBITAI2026', 'KBITTEST'];
    const code = inviteCode.trim().toUpperCase();
    
    if (demoCodes.includes(code)) {
      setShowRegister(true);
      setIsVerifying(false);
      return;
    }

    try {
      const response = await fetch(`/api/invite/verify/${code}`);
      const data = await response.json();

      if (data.valid) {
        setShowRegister(true);
      } else {
        setError(data.message || '邀请码无效');
      }
    } catch (err) {
      console.error('邀请码验证失败:', err);
      setError('网络错误，请检查后端服务是否运行');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleLogin = async () => {
    if (!registerData.email || !registerData.password) {
      setError('请填写邮箱和密码');
      return;
    }

    if (!registerData.email.includes('@')) {
      setError('请输入有效的邮箱地址');
      return;
    }

    setIsLoggingIn(true);
    setError('');

    try {
      const response = await fetch('/architect/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: registerData.email,
          password: registerData.password
        })
      });

      const data = await response.json();

      if (data.success) {
        const sessionData = {
          email: data.user.email,
          tier: data.user.tier,
          points: data.user.totalPoints || 1000,
          userId: data.user.userId
        };
        localStorage.setItem('architect-invite-session', JSON.stringify(sessionData));
        localStorage.setItem('architect-user-tier-v150', data.user.tier);
        localStorage.setItem('architect-user-points-v160', JSON.stringify({
          daily: 200,
          purchased: data.user.totalPoints || 1000,
          lastReset: new Date().toDateString()
        }));
        onVerified(sessionData);
      } else {
        setError(data.error || '登录失败');
      }
    } catch (err) {
      console.error('登录失败:', err);
      setError('网络错误，请检查后端服务是否运行');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleRegister = async () => {
    if (!registerData.email || !registerData.password) {
      setError('请填写邮箱和密码');
      return;
    }

    if (!registerData.email.includes('@')) {
      setError('请输入有效的邮箱地址');
      return;
    }

    if (registerData.password.length < 6) {
      setError('密码长度至少需要6位');
      return;
    }

    setIsRegistering(true);
    setError('');

    const demoCodes = ['KBITDEMO1', 'KBITAI2026', 'KBITTEST'];
    const code = inviteCode.trim().toUpperCase();
    
    if (demoCodes.includes(code)) {
      const sessionData = {
          email: registerData.email,
          nickname: registerData.nickname || registerData.email.split('@')[0],
          tier: 'beta',
          points: 1000,
          userId: 'demo-' + Date.now()
        };
        localStorage.setItem('architect-invite-session', JSON.stringify(sessionData));
      localStorage.setItem('architect-user-tier-v150', 'beta');
      localStorage.setItem('architect-user-points-v160', JSON.stringify({
        daily: 200,
        purchased: 1000,
        lastReset: new Date().toDateString()
      }));
      onVerified(sessionData);
      setIsRegistering(false);
      return;
    }

    try {
      const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const apiBase = isDev ? 'http://localhost:3001' : 'https://api.kbitai.com.cn';
      const response = await fetch(`${apiBase}/api/invite/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code,
          email: registerData.email,
          password: registerData.password,
          nickname: registerData.nickname || registerData.email.split('@')[0]
        })
      });

      const data = await response.json();

      if (data.success) {
        const sessionData = {
          email: data.user.email,
          tier: data.user.tier,
          points: data.user.totalPoints,
          userId: data.user.userId
        };
        localStorage.setItem('architect-invite-session', JSON.stringify(sessionData));
        localStorage.setItem('architect-user-tier-v150', data.user.tier);
        localStorage.setItem('architect-user-points-v160', JSON.stringify({
          daily: 200,
          purchased: data.user.totalPoints,
          lastReset: new Date().toDateString()
        }));
        onVerified(sessionData);
      } else {
        if (data.error === '该邮箱已注册') {
          setError(data.error);
        } else {
          setError(data.error || '注册失败');
        }
      }
    } catch (err) {
      console.error('注册失败:', err);
      setError('网络错误，请检查后端服务是否运行');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleFocus = useCallback((id: string) => {
    setFocusedField(id);
  }, []);

  const handleBlur = useCallback(() => {
    setFocusedField(null);
  }, []);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      setEmailError('');
      return false;
    }
    if (!email.includes('@')) {
      setEmailError('请输入包含@的邮箱地址');
      return false;
    }
    if (!emailRegex.test(email)) {
      setEmailError('请输入有效的邮箱格式');
      return false;
    }
    setEmailError('');
    return true;
  };

  const validatePassword = (password: string) => {
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

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-[pulse_4s_ease-in-out_infinite]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-[pulse_4s_ease-in-out_infinite_1s]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute top-20 right-20 w-2 h-2 bg-white/20 rounded-full animate-ping" />
        <div className="absolute bottom-32 left-24 w-1.5 h-1.5 bg-indigo-400/30 rounded-full animate-ping delay-500" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-10 animate-[fadeInUp_0.6s_ease-out]">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full shadow-2xl shadow-indigo-500/30 mb-6 overflow-hidden transition-transform duration-300 hover:scale-105">
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
          className="bg-white/5 backdrop-blur-xl rounded-[3rem] p-10 border border-white/10 shadow-2xl transition-all duration-500 hover:shadow-indigo-500/10 hover:border-white/15"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)'
          }}
        >
          {!showRegister && !showLoginForm ? (
            <>
              <div className="text-center mb-8">
                <h2 className="text-xl font-black text-white mb-2">邀请码验证</h2>
                <p className="text-slate-400 text-sm">本系统仅限邀请用户体验，请输入邀请码</p>
              </div>

              <div className="space-y-5">
                <InputField
                  label="邀请码"
                  type="text"
                  value={inviteCode}
                  onChange={(value) => {
                    const filtered = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                    setInviteCode(filtered);
                    setError('');
                  }}
                  placeholder="KBXXXXXX"
                  id="invite-code"
                  maxLength={12}
                  isFocused={focusedField === 'invite-code'}
                  hasError={inviteCode && codeStatus === 'invalid'}
                  hasSuccess={inviteCode && codeStatus === 'valid'}
                  errorMessage="邀请码格式不正确（6-12位字母或数字）"
                  onFocus={() => handleFocus('invite-code')}
                  onBlur={() => {
                    handleBlur();
                    if (inviteCode) {
                      if (/^[A-Z0-9]{6,12}$/.test(inviteCode)) {
                        setCodeStatus('valid');
                      } else {
                        setCodeStatus('invalid');
                      }
                    } else {
                      setCodeStatus('empty');
                    }
                  }}
                />

                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl animate-[fadeIn_0.3s_ease-out]">
                    <p className="text-red-400 text-sm text-center">{error}</p>
                  </div>
                )}

                <button
                  onClick={handleVerify}
                  disabled={isVerifying}
                  className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-2xl font-black text-sm uppercase tracking-wider transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98]"
                >
                  {isVerifying ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      验证中...
                    </span>
                  ) : (
                    '验证邀请码'
                  )}
                </button>
              </div>

              <div className="mt-8 space-y-4">
                <div className="pt-6 border-t border-white/10">
                  <p className="text-center text-slate-500 text-xs">
                    还没有邀请码？
                    <button 
                      onClick={() => setShowApplication(true)}
                      className="text-indigo-400 hover:text-indigo-300 ml-1 underline transition-colors"
                    >
                      申请内测
                    </button>
                  </p>
                </div>
                <div className="pt-4 border-t border-white/10">
                  <button
                    onClick={() => setShowLoginForm(true)}
                    className="w-full py-3 bg-white/5 border border-white/10 rounded-2xl text-white font-medium text-sm hover:bg-white/10 transition-all duration-300 hover:border-white/20 hover:scale-[1.01] active:scale-[0.99]"
                  >
                    已有账号？直接登录
                  </button>
                </div>
              </div>
            </>
          ) : showLoginForm ? (
            <>
              <div className="text-center mb-8">
                <h2 className="text-xl font-black text-white mb-2">用户登录</h2>
                <p className="text-slate-400 text-sm">请使用您的账号密码登录</p>
              </div>

              <div className="space-y-4">
                <InputField
                  label="邮箱地址"
                  type="email"
                  value={registerData.email}
                  onChange={(value) => {
                    setRegisterData({...registerData, email: value});
                    setError('');
                  }}
                  placeholder="xxx@email.com"
                  id="login-email"
                  isFocused={focusedField === 'login-email'}
                  hasError={!!emailError}
                  hasSuccess={registerData.email && validateEmail(registerData.email)}
                  errorMessage={emailError}
                  onFocus={() => handleFocus('login-email')}
                  onBlur={() => {
                    handleBlur();
                    validateEmail(registerData.email);
                  }}
                />

                <button
                  type="button"
                  onClick={() => setShowPasswordReset(true)}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors text-right w-full"
                >
                  忘记密码？
                </button>
                <InputField
                  label="登录密码"
                  type="password"
                  value={registerData.password}
                  onChange={(value) => setRegisterData({...registerData, password: value})}
                  placeholder="请输入密码"
                  id="login-password"
                  showToggle={true}
                  toggleState={showPassword}
                  onToggle={() => setShowPassword(p => !p)}
                  isFocused={focusedField === 'login-password'}
                  onFocus={() => handleFocus('login-password')}
                  onBlur={handleBlur}
                />

                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl animate-[fadeIn_0.3s_ease-out]">
                    <p className="text-red-400 text-sm text-center">{error}</p>
                  </div>
                )}

                <button
                  onClick={handleLogin}
                  disabled={isLoggingIn}
                  className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-2xl font-black text-sm uppercase tracking-wider transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98]"
                >
                  {isLoggingIn ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      登录中...
                    </span>
                  ) : (
                    '登录账号'
                  )}
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <button
                  onClick={() => setShowLoginForm(false)}
                  className="w-full text-slate-500 text-sm hover:text-white transition-colors duration-200"
                >
                  ← 返回邀请码验证
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="text-center mb-8">
                <h2 className="text-xl font-black text-white mb-2">邀请码有效</h2>
                <p className="text-slate-400 text-sm">请完成账号注册以开始体验</p>
              </div>

              <div className="space-y-4">
                <InputField
                  label="邮箱地址"
                  type="email"
                  value={registerData.email}
                  onChange={(value) => {
                    setRegisterData({...registerData, email: value});
                    setError('');
                  }}
                  placeholder="xxx@email.com"
                  id="register-email"
                  isFocused={focusedField === 'register-email'}
                  hasError={!!emailError}
                  hasSuccess={registerData.email && validateEmail(registerData.email)}
                  errorMessage={emailError}
                  onFocus={() => handleFocus('register-email')}
                  onBlur={() => {
                    handleBlur();
                    validateEmail(registerData.email);
                  }}
                />

                <InputField
                  label="登录密码"
                  type="password"
                  value={registerData.password}
                  onChange={(value) => {
                    setRegisterData({...registerData, password: value});
                    validatePassword(value);
                    setError('');
                  }}
                  placeholder="设置登录密码"
                  id="register-password"
                  showToggle={true}
                  toggleState={showPassword}
                  onToggle={() => setShowPassword(p => !p)}
                  isFocused={focusedField === 'register-password'}
                  hasError={!!passwordError}
                  errorMessage={passwordError}
                  onFocus={() => handleFocus('register-password')}
                  onBlur={handleBlur}
                />
                {registerData.password && (
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
                  label="昵称 (选填)"
                  type="text"
                  value={registerData.nickname}
                  onChange={(value) => setRegisterData({...registerData, nickname: value})}
                  placeholder="为自己取个昵称"
                  id="register-nickname"
                  isFocused={focusedField === 'register-nickname'}
                  onFocus={() => handleFocus('register-nickname')}
                  onBlur={handleBlur}
                />

                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl animate-[fadeIn_0.3s_ease-out]">
                    <p className="text-red-400 text-sm text-center">{error}</p>
                  </div>
                )}

                <div className="flex items-start gap-3 p-4 bg-gradient-to-r from-indigo-500/15 to-purple-500/15 border border-indigo-500/20 rounded-2xl">
                  <span className="text-2xl">🎁</span>
                  <div>
                    <p className="text-indigo-300 text-sm font-bold">内测专属福利</p>
                    <p className="text-slate-400 text-xs">注册即送 <span className="text-green-400 font-bold">1000 积分</span> 体验金</p>
                  </div>
                </div>

                <button
                  onClick={handleRegister}
                  disabled={isRegistering}
                  className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-2xl font-black text-sm uppercase tracking-wider transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98]"
                >
                  {isRegistering ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      注册中...
                    </span>
                  ) : (
                    '创建账号开始体验'
                  )}
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {error === '该邮箱已注册' && (
                  <button
                    onClick={() => setShowLoginForm(true)}
                    className="w-full py-3 bg-white/5 border border-white/10 rounded-2xl text-white font-medium text-sm hover:bg-white/10 transition-all duration-300 hover:border-white/20"
                  >
                    已有账号？点击登录
                  </button>
                )}
                <button
                  onClick={() => setShowRegister(false)}
                  className="w-full text-slate-500 text-sm hover:text-white transition-colors duration-200"
                >
                  ← 返回修改邀请码
                </button>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          本应用仅限邀请注册、内部试用，不向公众提供服务
        </p>
      </div>

      {showApplication && (
        <BetaApplicationBanner onClose={() => setShowApplication(false)} />
      )}

      {showPasswordReset && (
        <PasswordReset onBack={() => setShowPasswordReset(false)} />
      )}
    </div>
  );
};

export default InviteVerify;