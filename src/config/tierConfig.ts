/**
 * [标准化] 用户等级配置 - 系统单一事实来源
 * 
 * 本文件定义了系统中所有用户等级的积分配额和相关配置。
 * 所有组件都应该从这里导入配置，而不是硬编码数值。
 * 
 * 等级说明:
 * - free (免费): 每日 200 积分
 * - beta (内测): 每日 200 积分
 * - basic (基础): 每日 400 积分  
 * - pro (专业): 每日 1,500 积分
 * - plus (高级): 每日 2,000 积分
 */

export type UserTier = 'free' | 'beta' | 'basic' | 'pro' | 'plus' | 'dev';

export interface TierConfig {
  dailyPoints: number;
  monthlyPoints: number;
  label: string;
  description?: string;
  imageWatermarkFreeDownloads: number; // 图片无水印下载次数（0=不支持，-1=无限）
  videoWatermarkFreeDownloads: number; // 视频无水印下载次数（0=不支持，-1=无限）
}

// [标准化] 用户等级每日积分配置 - 系统单一事实来源
export const TIER_CONFIG: Record<UserTier, TierConfig> = {
  free: {
    dailyPoints: 200,
    monthlyPoints: 6000,
    label: '免费用户',
    description: '基础功能访问权限',
    imageWatermarkFreeDownloads: 0,
    videoWatermarkFreeDownloads: 0
  },
  beta: {
    dailyPoints: 200,
    monthlyPoints: 6000,
    label: '内测用户',
    description: '内测体验权限',
    imageWatermarkFreeDownloads: -1,
    videoWatermarkFreeDownloads: 0
  },
  basic: {
    dailyPoints: 400,
    monthlyPoints: 12000,
    label: '基础级',
    description: '基础付费套餐',
    imageWatermarkFreeDownloads: 10,
    videoWatermarkFreeDownloads: 0
  },
  pro: {
    dailyPoints: 1500,
    monthlyPoints: 45000,
    label: 'PRO级',
    description: '专业付费套餐',
    imageWatermarkFreeDownloads: 50,
    videoWatermarkFreeDownloads: 5
  },
  plus: {
    dailyPoints: 2000,
    monthlyPoints: 60000,
    label: 'PLUS级',
    description: '高级付费套餐',
    imageWatermarkFreeDownloads: -1,
    videoWatermarkFreeDownloads: -1
  },
  dev: {
    dailyPoints: 999999999,
    monthlyPoints: 999999999,
    label: '开发者',
    description: '内部开发账号',
    imageWatermarkFreeDownloads: -1,
    videoWatermarkFreeDownloads: -1
  }
};

/**
 * 获取指定用户等级的配置
 */
export function getTierConfig(tier: UserTier | string): TierConfig {
  return TIER_CONFIG[tier as UserTier] || TIER_CONFIG.free;
}

/**
 * 获取指定用户等级的每日积分配额
 */
export function getDailyPoints(tier: UserTier | string): number {
  return getTierConfig(tier).dailyPoints;
}

/**
 * 获取指定用户等级的每月积分配额
 */
export function getMonthlyPoints(tier: UserTier | string): number {
  return getTierConfig(tier).monthlyPoints;
}

/**
 * 验证用户等级是否有效
 */
export function isValidTier(tier: string): tier is UserTier {
  return tier in TIER_CONFIG;
}

/**
 * 格式化积分数值显示（添加千位分隔符）
 */
export function formatPoints(points: number): string {
  return points.toLocaleString();
}

/**
 * 获取所有用户等级列表
 */
export function getAllTiers(): UserTier[] {
  return Object.keys(TIER_CONFIG) as UserTier[];
}

export default TIER_CONFIG;