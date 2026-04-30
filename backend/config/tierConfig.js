/**
 * [标准化] 用户等级配置 - 系统单一事实来源
 * 
 * 本文件定义了系统中所有用户等级的积分配额和相关配置。
 * 所有后端控制器和服务都应该从这里导入配置。
 * 
 * 等级说明:
 * - free (免费): 每日 200 积分
 * - beta (内测): 每日 200 积分 + 注册赠送1000积分体验金
 * - basic (基础): 每日 400 积分  
 * - pro (专业): 每日 1,500 积分
 * - plus (高级): 每日 2,000 积分
 */

// [标准化] 用户等级每日积分配置 - 系统单一事实来源
const tierDailyQuota = {
  'free': 200,
  'beta': 200,
  'basic': 400,
  'pro': 1500,
  'plus': 2000
};

// 每月积分配额（每日 * 30天）
const tierMonthlyQuota = {
  'free': 6000,
  'beta': 6000,
  'basic': 12000,
  'pro': 45000,
  'plus': 60000
};

// 用户等级显示名称
const tierLabels = {
  'free': '免费用户',
  'beta': '内测用户',
  'basic': '基础级',
  'pro': 'PRO级',
  'plus': 'PLUS级'
};

// 图片无水印下载次数配置（0=不支持，-1=无限）
const imageWatermarkFreeDownloads = {
  'free': 0,
  'beta': -1,
  'basic': 10,
  'pro': 50,
  'plus': -1
};

// 视频无水印下载次数配置（0=不支持，-1=无限）
const videoWatermarkFreeDownloads = {
  'free': 0,
  'beta': 0,
  'basic': 0,
  'pro': 5,
  'plus': -1
};

/**
 * 获取指定用户等级的每日积分配额
 */
function getDailyPoints(tier) {
  return tierDailyQuota[tier] || tierDailyQuota['free'];
}

/**
 * 获取指定用户等级的每月积分配额
 */
function getMonthlyPoints(tier) {
  return tierMonthlyQuota[tier] || tierMonthlyQuota['free'];
}

/**
 * 获取用户等级显示名称
 */
function getTierLabel(tier) {
  return tierLabels[tier] || tierLabels['free'];
}

/**
 * 获取图片无水印下载次数
 */
function getImageWatermarkFreeDownloads(tier) {
  return imageWatermarkFreeDownloads[tier] || 0;
}

/**
 * 获取视频无水印下载次数
 */
function getVideoWatermarkFreeDownloads(tier) {
  return videoWatermarkFreeDownloads[tier] || 0;
}

/**
 * 验证用户等级是否有效
 */
function isValidTier(tier) {
  return tier in tierDailyQuota;
}

/**
 * 获取所有用户等级列表
 */
function getAllTiers() {
  return Object.keys(tierDailyQuota);
}

module.exports = {
  tierDailyQuota,
  tierMonthlyQuota,
  tierLabels,
  imageWatermarkFreeDownloads,
  videoWatermarkFreeDownloads,
  getDailyPoints,
  getMonthlyPoints,
  getTierLabel,
  getImageWatermarkFreeDownloads,
  getVideoWatermarkFreeDownloads,
  isValidTier,
  getAllTiers
};