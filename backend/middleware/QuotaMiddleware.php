<?php
/**
 * 首席图像架构师 - 配额中间件
 * 
 * @package KbitArchitect
 * @version 1.0.0
 */

namespace KbitArchitect\Middleware;

use KbitArchitect\Core\Database;
use KbitArchitect\Models\QuotaManager;

class QuotaMiddleware extends Middleware
{
    private string $feature;
    private float $estimatedCost;

    public function __construct(string $feature, float $estimatedCost = 0)
    {
        $this->feature = $feature;
        $this->estimatedCost = $estimatedCost;
    }

    public function handle(): bool
    {
        $userId = $GLOBALS['auth_user']['id'] ?? null;
        $userTier = $GLOBALS['auth_user']['tier'] ?? 'free';

        if (!$userId) {
            $this->error('User not authenticated', 401);
            return false;
        }

        $quotaManager = new QuotaManager();
        
        $check = $quotaManager->checkQuota($userId, $this->feature, $this->estimatedCost);

        if (!$check['allowed']) {
            $this->json([
                'success' => false,
                'error' => $check['reason'],
                'quota' => $check['quota']
            ], 402);
            return false;
        }

        $GLOBALS['quota_info'] = $check['quota'];
        
        return true;
    }

    public static function getQuotaInfo(): ?array
    {
        return $GLOBALS['quota_info'] ?? null;
    }
}
