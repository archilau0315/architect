<?php
/**
 * 首席图像架构师 - 配额管理器
 * 
 * 实现额度预扣、检查、退还等功能
 * 
 * @package KbitArchitect
 * @version 1.0.0
 */

namespace KbitArchitect\Models;

use KbitArchitect\Core\Database;
use RuntimeException;

class QuotaManager
{
    private Database $db;
    private array $config;
    private User $userModel;

    public function __construct()
    {
        $this->db = Database::getInstance();
        $this->userModel = new User();
        $this->loadConfig();
    }

    private function loadConfig(): void
    {
        $configs = $this->db->query('SELECT config_key, config_value, config_type FROM system_config');
        $this->config = [];
        foreach ($configs as $config) {
            $value = $config['config_value'];
            if ($config['config_type'] === 'number') {
                $value = (float) $value;
            } elseif ($config['config_type'] === 'boolean') {
                $value = filter_var($value, FILTER_VALIDATE_BOOLEAN);
            }
            $this->config[$config['config_key']] = $value;
        }
    }

    public function checkQuota(int $userId, string $feature, float $estimatedCost = 0): array
    {
        $user = $this->userModel->findById($userId);
        
        if (!$user) {
            return ['allowed' => false, 'reason' => '用户不存在'];
        }
        
        if ($user['status'] != 1) {
            return ['allowed' => false, 'reason' => '账户已被禁用'];
        }
        
        $tierConfig = $this->userModel->getTierConfig($user['user_tier']);
        
        if (!$tierConfig) {
            return ['allowed' => false, 'reason' => '订阅等级配置错误'];
        }
        
        $totalPoints = (float) $user['daily_points'] + (float) $user['purchased_points'];
        
        if ($estimatedCost > 0 && $totalPoints < $estimatedCost) {
            return [
                'allowed' => false,
                'reason' => '积分不足',
                'quota' => [
                    'total_points' => $totalPoints,
                    'required_points' => $estimatedCost,
                    'tier' => $user['user_tier']
                ]
            ];
        }
        
        $usageCheck = $this->checkUsageLimit($userId, $feature, $tierConfig);
        if (!$usageCheck['allowed']) {
            return $usageCheck;
        }
        
        return [
            'allowed' => true,
            'quota' => [
                'total_points' => $totalPoints,
                'daily_points' => (float) $user['daily_points'],
                'purchased_points' => (float) $user['purchased_points'],
                'tier' => $user['user_tier'],
                'tier_name' => $tierConfig['tier_name'],
                'estimated_cost' => $estimatedCost,
                'limits' => [
                    'daily_image' => $tierConfig['daily_image_limit'],
                    'daily_video' => $tierConfig['daily_video_limit'],
                    'daily_chat' => $tierConfig['daily_chat_limit'],
                    'max_resolution' => $tierConfig['max_resolution']
                ]
            ]
        ];
    }

    private function checkUsageLimit(int $userId, string $feature, array $tierConfig): array
    {
        $today = date('Y-m-d');
        
        $usage = $this->db->queryOne(
            'SELECT 
                COUNT(CASE WHEN feature = "image_gen" THEN 1 END) as image_count,
                COUNT(CASE WHEN feature = "video_gen" THEN 1 END) as video_count,
                COUNT(CASE WHEN feature = "chat" THEN 1 END) as chat_count
             FROM usage_logs 
             WHERE user_id = ? AND DATE(created_at) = ? AND status = "success"',
            [$userId, $today]
        );
        
        if (!$usage) {
            $usage = ['image_count' => 0, 'video_count' => 0, 'chat_count' => 0];
        }
        
        $limits = [
            'image_gen' => ['limit' => $tierConfig['daily_image_limit'], 'used' => $usage['image_count'] ?? 0],
            'video_gen' => ['limit' => $tierConfig['daily_video_limit'], 'used' => $usage['video_count'] ?? 0],
            'chat' => ['limit' => $tierConfig['daily_chat_limit'], 'used' => $usage['chat_count'] ?? 0],
        ];
        
        $featureLimit = $limits[$feature] ?? null;
        
        if ($featureLimit && $featureLimit['limit'] > 0 && $featureLimit['used'] >= $featureLimit['limit']) {
            return [
                'allowed' => false,
                'reason' => "今日{$feature}使用次数已达上限",
                'quota' => [
                    'used' => $featureLimit['used'],
                    'limit' => $featureLimit['limit']
                ]
            ];
        }
        
        return ['allowed' => true];
    }

    public function preDeduct(int $userId, float $amount, string $feature, string $requestId): array
    {
        if (!($this->config['quota.enable_prededuct'] ?? true)) {
            return ['success' => true, 'message' => '预扣未启用'];
        }
        
        $user = $this->userModel->findById($userId);
        
        if (!$user) {
            return ['success' => false, 'error' => '用户不存在'];
        }
        
        $totalPoints = (float) $user['daily_points'] + (float) $user['purchased_points'];
        
        if ($totalPoints < $amount) {
            return ['success' => false, 'error' => '积分不足'];
        }
        
        $this->db->beginTransaction();
        
        try {
            $success = $this->userModel->deductPoints(
                $userId,
                $amount,
                'prededuct',
                $requestId,
                "预扣 - {$feature}"
            );
            
            if (!$success) {
                $this->db->rollBack();
                return ['success' => false, 'error' => '积分扣除失败'];
            }
            
            $this->db->commit();
            
            return [
                'success' => true,
                'deducted' => $amount,
                'request_id' => $requestId
            ];
        } catch (\Exception $e) {
            $this->db->rollBack();
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    public function confirm(int $userId, float $actualCost, string $requestId): bool
    {
        return true;
    }

    public function refund(int $userId, float $amount, string $requestId, string $reason = 'API调用失败'): bool
    {
        if (!($this->config['quota.refund_on_failure'] ?? true)) {
            return true;
        }
        
        return $this->userModel->refundPoints(
            $userId,
            $amount,
            'refund',
            $requestId,
            $reason
        );
    }

    public function calculateCost(string $feature, array $params = []): float
    {
        $pointsConfig = [
            'image_gen' => [
                '1K' => $this->config['points.image_1k'] ?? 10,
                '2K' => $this->config['points.image_2k'] ?? 15,
                '4K' => $this->config['points.image_4k'] ?? 25,
            ],
            'video_gen' => [
                'standard' => $this->config['points.video_standard'] ?? 50,
                'hd' => $this->config['points.video_hd'] ?? 100,
            ],
            'chat' => 0,
            'image_analyze' => 5,
            'prompt_enhance' => 2
        ];
        
        if ($feature === 'image_gen') {
            $resolution = $params['resolution'] ?? '1K';
            $count = $params['count'] ?? 1;
            $baseCost = $pointsConfig['image_gen'][$resolution] ?? $pointsConfig['image_gen']['1K'];
            return $baseCost * $count;
        }
        
        if ($feature === 'video_gen') {
            $quality = $params['quality'] ?? 'standard';
            $duration = $params['duration'] ?? 5;
            $baseCost = $pointsConfig['video_gen'][$quality] ?? $pointsConfig['video_gen']['standard'];
            return $baseCost * ($duration / 5);
        }
        
        if ($feature === 'chat') {
            $tokens = $params['tokens'] ?? 1000;
            $costPerK = $this->config['points.chat_1k_tokens'] ?? 1;
            return ($tokens / 1000) * $costPerK;
        }
        
        return $pointsConfig[$feature] ?? 0;
    }

    public function checkResolution(int $userId, string $requestedResolution): array
    {
        $user = $this->userModel->findById($userId);
        
        if (!$user) {
            return ['allowed' => false, 'reason' => '用户不存在'];
        }
        
        $tierConfig = $this->userModel->getTierConfig($user['user_tier']);
        
        if (!$tierConfig) {
            return ['allowed' => false, 'reason' => '订阅等级配置错误'];
        }
        
        $resolutionOrder = ['1K' => 1, '2K' => 2, '4K' => 3];
        $userMaxResolution = $tierConfig['max_resolution'];
        
        $requestedLevel = $resolutionOrder[$requestedResolution] ?? 1;
        $maxLevel = $resolutionOrder[$userMaxResolution] ?? 1;
        
        if ($requestedLevel > $maxLevel) {
            return [
                'allowed' => false,
                'reason' => "您的订阅等级最高支持{$userMaxResolution}分辨率",
                'max_resolution' => $userMaxResolution
            ];
        }
        
        return ['allowed' => true, 'max_resolution' => $userMaxResolution];
    }

    public function getUserQuotaInfo(int $userId): array
    {
        $user = $this->userModel->findById($userId);
        
        if (!$user) {
            return [];
        }
        
        $tierConfig = $this->userModel->getTierConfig($user['user_tier']);
        $usageStats = $this->userModel->getUsageStats($userId, 'today');
        
        return [
            'user' => [
                'id' => $user['id'],
                'nickname' => $user['nickname'],
                'tier' => $user['user_tier'],
                'tier_name' => $tierConfig['tier_name'] ?? '未知',
                'tier_expires_at' => $user['tier_expires_at']
            ],
            'points' => [
                'daily' => (float) $user['daily_points'],
                'purchased' => (float) $user['purchased_points'],
                'total' => (float) $user['daily_points'] + (float) $user['purchased_points'],
                'total_consumed' => (float) $user['total_consumed_points']
            ],
            'limits' => [
                'daily_image' => [
                    'limit' => $tierConfig['daily_image_limit'] ?? 0,
                    'used' => $usageStats['successful_requests'] ?? 0
                ],
                'daily_video' => [
                    'limit' => $tierConfig['daily_video_limit'] ?? 0,
                    'used' => 0
                ],
                'max_resolution' => $tierConfig['max_resolution'] ?? '1K',
                'watermark_free_downloads' => $tierConfig['watermark_free_downloads'] ?? 0
            ],
            'features' => json_decode($tierConfig['features'] ?? '{}', true)
        ];
    }
}
