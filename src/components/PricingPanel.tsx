
import React from 'react';
import { UserTier } from '../../types.ts';
import { X, Check, Zap, Shield, Crown, Star } from 'lucide-react';

interface PricingPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentTier: UserTier;
  credits: number;
  onSelectTier: (tier: UserTier) => void;
  onBuyCredits: (amount: number) => void;
}

const PricingPanel: React.FC<PricingPanelProps> = ({ isOpen, onClose, currentTier, credits, onSelectTier, onBuyCredits }) => {
  if (!isOpen) return null;

  const [hoveredTier, setHoveredTier] = React.useState<UserTier | null>(null);

  const tiers = [
    {
      id: 'free' as UserTier,
      name: '免费用户',
      price: '0',
      credits: '150',
      icon: <Star className="w-6 h-6 text-slate-400" />,
      features: ['每日 150 积分', '仅限带水印下载', '视频生成禁用', '历史记录保留 1 天'],
      color: 'bg-slate-100 dark:bg-slate-800'
    },
    {
      id: 'basic' as UserTier,
      name: '基础级',
      price: '39',
      credits: '1,500',
      icon: <Zap className="w-6 h-6 text-blue-500" />,
      features: ['每日 1,500 积分', '约 100 张图/日', '5 次视频/日 (快速)', '图像 10 次无水印/日', '历史记录保留 7 天'],
      color: 'bg-blue-50 dark:bg-blue-900/20',
      highlight: true
    },
    {
      id: 'pro' as UserTier,
      name: 'PRO 级',
      price: '89',
      credits: '5,000',
      icon: <Shield className="w-6 h-6 text-theme" />,
      features: ['每日 5,000 积分', '约 333 张图/日', '16 次视频/日 (全引擎)', '图像无限无水印下载', '历史记录保留 30 天'],
      color: 'bg-theme/5 dark:bg-theme/20',
      recommended: true
    },
    {
      id: 'plus' as UserTier,
      name: 'PLUS 级',
      price: '199',
      credits: '15,000',
      icon: <Crown className="w-6 h-6 text-amber-500" />,
      features: ['每日 15,000 积分', '约 1,000 张图/日', '50 次视频/日 (全引擎)', '全功能无限无水印下载', '永久云端存储'],
      color: 'bg-amber-50 dark:bg-amber-900/20'
    }
  ];

  const creditPacks = [
    { amount: 100, price: 1 },
    { amount: 200, price: 2 },
    { amount: 500, price: 5 },
    { amount: 1000, price: 10 },
    { amount: 2000, price: 20 },
    { amount: 5000, price: 50 },
    { amount: 10000, price: 100 }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="w-full max-w-6xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-theme rounded-2xl flex items-center justify-center shadow-lg shadow-theme">
              <Crown className="text-white w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">订阅与积分中心</h2>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Subscription & Credit Management</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">当前余额</div>
              <div className="text-2xl font-black text-theme dark:text-theme-light tabular-nums">{credits.toLocaleString()} <span className="text-xs font-bold text-slate-400">PTS</span></div>
            </div>
            <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-rose-500 hover:text-white transition-all">
              <X size={20} strokeWidth={3} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-12">
          {/* Tiers Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {tiers.map((tier) => (
              <div 
                key={tier.id}
                onMouseEnter={() => setHoveredTier(tier.id)}
                onMouseLeave={() => setHoveredTier(null)}
                className={`relative p-8 rounded-[2.5rem] border-2 transition-all group ${
                  currentTier === tier.id 
                    ? 'border-theme ring-4 ring-theme/10 scale-105 z-10' 
                    : hoveredTier === tier.id || (hoveredTier === null && tier.id === 'basic')
                      ? 'border-theme ring-2 ring-theme/20 scale-105 z-10' 
                      : 'border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                } ${tier.color}`}
              >
                {tier.recommended && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-theme text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg">
                    最受欢迎
                  </div>
                )}
                
                <div className="mb-6 flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 flex items-center justify-center shadow-sm">
                    {tier.icon}
                  </div>
                  {currentTier === tier.id && (
                    <span className="px-3 py-1 bg-theme text-white text-[9px] font-black uppercase tracking-widest rounded-lg">当前等级</span>
                  )}
                </div>

                <div className="mb-6">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">{tier.name}</h3>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-3xl font-black text-slate-900 dark:text-white">¥{tier.price}</span>
                    <span className="text-xs font-bold text-slate-500">/月</span>
                  </div>
                </div>

                <div className="space-y-4 mb-8">
                  {tier.features.map((feat, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <Check className="w-4 h-4 text-theme shrink-0 mt-0.5" />
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400 leading-tight">{feat}</span>
                    </div>
                  ))}
                </div>

                <button 
                  onClick={() => onSelectTier(tier.id)}
                  disabled={currentTier === tier.id}
                  className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${
                    currentTier === tier.id
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                      : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:scale-[1.02] active:scale-95 shadow-xl'
                  }`}
                >
                  {currentTier === tier.id ? '已订阅' : '立即升级'}
                </button>
              </div>
            ))}
          </div>

          {/* Credits Top-up */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900 dark:text-white italic">积分加油站 <span className="text-theme font-normal tracking-normal">Credit Top-up</span></h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">积分每日清零，请按需购买</p>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
              {creditPacks.map((pack) => (
                <button 
                  key={pack.amount}
                  onClick={() => onBuyCredits(pack.amount)}
                  className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-theme hover:ring-4 hover:ring-theme/10 transition-all group text-center"
                >
                  <div className="text-lg font-black text-slate-900 dark:text-white mb-1 group-hover:text-theme transition-colors">{pack.amount}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">POINTS</div>
                  <div className="py-2 bg-white dark:bg-slate-900 rounded-xl text-xs font-black text-slate-900 dark:text-white border border-slate-100 dark:border-white/5 shadow-sm">
                    ¥{pack.price}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <Shield size={14} className="text-theme" />
            安全支付保障 | 积分每日 00:00 自动清零
          </div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            © 2026 Kuanform Creative Engine
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingPanel;
