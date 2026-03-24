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

  // 从URL获取token（用于邮件链接）
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    if (urlToken) {
      setToken(urlToken);
      verifyToken(urlToken);
    }
  }, []);

  const verifyToken = async (tokenToVerify: string) => {
    try {
      const response = await fetch(`/api/auth/verify-reset-token?token=${tokenToVerify}`);
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

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('重置链接已发送到您的邮箱');
        setStep('verify');
        // 开发环境显示token
        if (data.token) {
          console.log('重置令牌:', data.token);
        }
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
      const response = await fetch('/api/auth/reset-password', {
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
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-3xl shadow-2xl shadow-indigo-500/30 mb-6 overflow-hidden">
            <img src="./archi01.png" alt="KBITAI" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-3xl font-black text-white italic tracking-wide mb-2">
            KBITAI <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Architect</span>
          </h1>
          <p className="text-indigo-300/60 text-sm font-medium tracking-widest uppercase">
            首席图像架构师 · 内测版
          </p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-[3rem] p-10 border border-white/10 shadow-2xl">
          {step === 'email' && (
            <>
              <div className="text-center mb-8">
                <h2 className="text-xl font-black text-white mb-2">忘记密码</h2>
                <p className="text-slate-400 text-sm">请输入您的邮箱地址，我们将发送重置链接</p>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-indigo-300 uppercase tracking-widest ml-2">
                    邮箱地址
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all"
                    onKeyDown={(e) => e.key === 'Enter' && handleRequestReset()}
                  />
                </div>

                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                    <p className="text-red-400 text-sm text-center">{error}</p>
                  </div>
                )}

                <button
                  onClick={handleRequestReset}
                  disabled={isLoading}
                  className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-2xl font-black text-sm uppercase tracking-wider hover:from-indigo-600 hover:to-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/25"
                >
                  {isLoading ? '发送中...' : '发送重置链接'}
                </button>
              </div>

              <button
                onClick={onBack}
                className="w-full mt-6 text-slate-500 text-sm hover:text-white transition-colors"
              >
                ← 返回登录
              </button>
            </>
          )}

          {step === 'verify' && (
            <>
              <div className="text-center mb-8">
                <div className="text-5xl mb-4">📧</div>
                <h2 className="text-xl font-black text-white mb-2">请查收邮件</h2>
                <p className="text-slate-400 text-sm">
                  我们已向 <span className="text-indigo-400">{email}</span> 发送了密码重置链接
                </p>
              </div>

              {success && (
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-2xl mb-6">
                  <p className="text-green-400 text-sm text-center">{success}</p>
                </div>
              )}

              <div className="space-y-4">
                <p className="text-slate-500 text-xs text-center">
                  如果没有收到邮件，请检查垃圾邮件文件夹或重试
                </p>

                <button
                  onClick={() => setStep('email')}
                  className="w-full py-4 bg-white/5 border border-white/10 text-white rounded-2xl font-black text-sm uppercase tracking-wider hover:bg-white/10 transition-all"
                >
                  重新发送
                </button>
              </div>

              <button
                onClick={onBack}
                className="w-full mt-6 text-slate-500 text-sm hover:text-white transition-colors"
              >
                ← 返回登录
              </button>
            </>
          )}

          {step === 'reset' && (
            <>
              <div className="text-center mb-8">
                <h2 className="text-xl font-black text-white mb-2">设置新密码</h2>
                <p className="text-slate-400 text-sm">请输入您的新密码</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-indigo-300 uppercase tracking-widest ml-2">
                    新密码
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-indigo-300 uppercase tracking-widest ml-2">
                    确认密码
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all"
                    onKeyDown={(e) => e.key === 'Enter' && handleResetPassword()}
                  />
                </div>

                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                    <p className="text-red-400 text-sm text-center">{error}</p>
                  </div>
                )}

                {success && (
                  <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-2xl">
                    <p className="text-green-400 text-sm text-center">{success}</p>
                  </div>
                )}

                <button
                  onClick={handleResetPassword}
                  disabled={isLoading}
                  className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-2xl font-black text-sm uppercase tracking-wider hover:from-indigo-600 hover:to-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/25"
                >
                  {isLoading ? '重置中...' : '重置密码'}
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
