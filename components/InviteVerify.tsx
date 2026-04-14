import React, { useState, useEffect, useRef } from 'react';
import BetaApplicationBanner from './BetaApplicationBanner.tsx';
import PasswordReset from './PasswordReset.tsx';
import { AVATAR_KEY } from '../constants.ts';

interface InviteVerifyProps {
  onVerified: (data: { email: string; tier: string; points: number }) => void;
}

const InviteVerify: React.FC<InviteVerifyProps> = ({ onVerified }) => {
  const [inviteCode, setInviteCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
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
  const avatarInputRef = useRef<HTMLInputElement>(null);

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
    
    // 检查URL中是否有重置令牌
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

    // 演示模式：允许特定邀请码
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
      // 后端连接失败时，显示错误信息
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
      // 后端连接失败时，显示错误信息
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

    setIsRegistering(true);
    setError('');

    // 演示模式：允许特定邀请码直接注册
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
      // 后端连接失败时，显示错误信息
      console.error('注册失败:', err);
      setError('网络错误，请检查后端服务是否运行');
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full shadow-2xl shadow-indigo-500/30 mb-6 overflow-hidden">
            <img src="/architect/archi01.png" alt="KBITAI" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-3xl font-black text-white italic tracking-wide mb-2 px-1">
            KBITAI <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Architect</span>
          </h1>
          <p className="text-indigo-300/60 text-sm font-medium tracking-widest uppercase">
            首席图像架构师 · 内测版
          </p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-[3rem] p-10 border border-white/10 shadow-2xl">
          {!showRegister && !showLoginForm ? (
            <>
              <div className="text-center mb-8">
                <h2 className="text-xl font-black text-white mb-2">邀请码验证</h2>
                <p className="text-slate-400 text-sm">本系统仅限邀请用户体验，请输入邀请码</p>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-indigo-300 uppercase tracking-widest ml-2">
                    邀请码
                  </label>
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="KBXXXXXXXX"
                    className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-mono text-lg tracking-[0.3em] outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all text-center placeholder:text-slate-600"
                    onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                  />
                </div>

                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                    <p className="text-red-400 text-sm text-center">{error}</p>
                  </div>
                )}

                <button
                  onClick={handleVerify}
                  disabled={isVerifying}
                  className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-2xl font-black text-sm uppercase tracking-wider hover:from-indigo-600 hover:to-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/25"
                >
                  {isVerifying ? '验证中...' : '验证邀请码'}
                </button>
              </div>

              <div className="mt-8 space-y-4">
                <div className="pt-6 border-t border-white/10">
                  <p className="text-center text-slate-500 text-xs">
                    还没有邀请码？
                    <button 
                      onClick={() => setShowApplication(true)}
                      className="text-indigo-400 hover:text-indigo-300 ml-1 underline"
                    >
                      申请内测
                    </button>
                  </p>
                </div>
                <div className="pt-4 border-t border-white/10">
                  <button
                    onClick={() => setShowLoginForm(true)}
                    className="w-full py-3 bg-white/5 border border-white/10 rounded-2xl text-white font-medium text-sm hover:bg-white/10 transition-colors"
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
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-indigo-300 uppercase tracking-widest ml-2">
                    邮箱地址
                  </label>
                  <input
                    type="email"
                    value={registerData.email}
                    onChange={(e) => setRegisterData({...registerData, email: e.target.value})}
                    placeholder="your@email.com"
                    className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between ml-2">
                    <label className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">
                      登录密码
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPasswordReset(true)}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      忘记密码？
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={registerData.password}
                      onChange={(e) => setRegisterData({...registerData, password: e.target.value})}
                      placeholder="••••••••"
                      className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all pr-14"
                    />
                    <button type="button" onClick={() => setShowPassword(p => !p)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                      {showPassword
                        ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                        : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      }
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                    <p className="text-red-400 text-sm text-center">{error}</p>
                  </div>
                )}

                <button
                  onClick={handleLogin}
                  disabled={isLoggingIn}
                  className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-2xl font-black text-sm uppercase tracking-wider hover:from-indigo-600 hover:to-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/25"
                >
                  {isLoggingIn ? '登录中...' : '登录账号'}
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <button
                  onClick={() => setShowLoginForm(false)}
                  className="w-full text-slate-500 text-sm hover:text-white transition-colors"
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
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-indigo-300 uppercase tracking-widest ml-2">
                    邮箱地址
                  </label>
                  <input
                    type="email"
                    value={registerData.email}
                    onChange={(e) => setRegisterData({...registerData, email: e.target.value})}
                    placeholder="your@email.com"
                    className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between ml-2">
                    <label className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">
                      登录密码
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPasswordReset(true)}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      忘记密码？
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={registerData.password}
                      onChange={(e) => setRegisterData({...registerData, password: e.target.value})}
                      placeholder="••••••••"
                      className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all pr-14"
                    />
                    <button type="button" onClick={() => setShowPassword(p => !p)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                      {showPassword
                        ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                        : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      }
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-indigo-300 uppercase tracking-widest ml-2">
                    昵称 <span className="text-slate-500">(选填)</span>
                  </label>
                  <input
                    type="text"
                    value={registerData.nickname}
                    onChange={(e) => setRegisterData({...registerData, nickname: e.target.value})}
                    placeholder="您的昵称"
                    className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all"
                  />
                </div>

                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                    <p className="text-red-400 text-sm text-center">{error}</p>
                  </div>
                )}

                <div className="flex items-start gap-3 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl">
                  <span className="text-2xl">🎁</span>
                  <div>
                    <p className="text-indigo-300 text-sm font-bold">内测专属福利</p>
                    <p className="text-slate-400 text-xs">注册即送 <span className="text-green-400 font-bold">1000 积分</span> 体验金</p>
                  </div>
                </div>

                <button
                  onClick={handleRegister}
                  disabled={isRegistering}
                  className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-2xl font-black text-sm uppercase tracking-wider hover:from-indigo-600 hover:to-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/25"
                >
                  {isRegistering ? '注册中...' : '创建账号开始体验'}
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {error === '该邮箱已注册' && (
                  <button
                    onClick={() => setShowLoginForm(true)}
                    className="w-full py-3 bg-white/5 border border-white/10 rounded-2xl text-white font-medium text-sm hover:bg-white/10 transition-colors"
                  >
                    已有账号？点击登录
                  </button>
                )}
                <button
                  onClick={() => setShowRegister(false)}
                  className="w-full text-slate-500 text-sm hover:text-white transition-colors"
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
