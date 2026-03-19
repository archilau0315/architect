import React, { useState, useEffect } from 'react';
import BetaApplicationBanner from './BetaApplicationBanner.tsx';

interface BetaPolicyBannerProps {
  onClose: () => void;
}

const BetaPolicyBanner: React.FC<BetaPolicyBannerProps> = ({ onClose }) => {
  const [showApplication, setShowApplication] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const maxX = window.innerWidth - 320;
    const maxY = window.innerHeight - 400;
    setPosition({
      x: Math.random() * maxX * 0.5 + maxX * 0.25,
      y: Math.random() * maxY * 0.5 + maxY * 0.25
    });
  }, []);

  const handleClose = () => {
    localStorage.setItem('architect-beta-banner-closed', 'true');
    onClose();
  };

  return (
    <div 
      className="fixed z-[9999] pointer-events-auto animate-float"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        animation: 'floatBeta 8s ease-in-out infinite'
      }}
    >
      <style>{`
        @keyframes floatBeta {
          0% { transform: translate(0, 0) rotate(0deg); }
          25% { transform: translate(30px, -20px) rotate(1deg); }
          50% { transform: translate(-20px, 30px) rotate(-1deg); }
          75% { transform: translate(-30px, -15px) rotate(0.5deg); }
          100% { transform: translate(0, 0) rotate(0deg); }
        }
      `}</style>
      
      <div className="relative w-72 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 rounded-3xl shadow-2xl overflow-hidden">
        <button 
          onClick={handleClose}
          className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center bg-white/20 hover:bg-white/40 rounded-full text-white text-sm font-bold transition-all z-10"
        >
          ✕
        </button>
        
        <div className="p-6 pt-10">
          <div className="text-center mb-4">
            <span className="inline-block px-3 py-1 bg-white/20 rounded-full text-[10px] font-black text-white uppercase tracking-widest">
              内测专属
            </span>
          </div>
          
          <h3 className="text-xl font-black text-white text-center mb-4 italic">
            🎯 Beta 用户权益
          </h3>
          
          <div className="space-y-2 text-white/90 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-green-300">✅</span>
              <span>赠送 <strong>1000 积分</strong> 体验金</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-300">✅</span>
              <span>每日 <strong>200 积分</strong> 可用额度</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-300">✅</span>
              <span>全功能体验权限</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-yellow-300">⚠️</span>
              <span>下载仅支持标准画质+水印</span>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-white/10 rounded-xl text-center">
            <p className="text-white/70 text-xs">
              本应用仅限邀请注册、内部试用，不向公众提供服务，不涉及商业收费。所有数据仅用于系统测试与内部使用，严格遵守网络安全与个人信息保护相关法律法规。
            </p>
          </div>
          
          <button 
            onClick={() => setShowApplication(true)}
            className="w-full mt-4 py-3 bg-white text-indigo-600 rounded-xl font-black text-sm uppercase tracking-wider hover:bg-white/90 transition-all shadow-lg"
          >
            申请内测资格
          </button>
        </div>
      </div>
      
      {showApplication && (
        <BetaApplicationBanner onClose={() => setShowApplication(false)} />
      )}
    </div>
  );
};

export default BetaPolicyBanner;
