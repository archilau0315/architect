<?php
/**
 * 首席图像架构师 - 用户控制器
 * 
 * @package KbitArchitect
 * @version 1.0.0
 */

namespace KbitArchitect\Controllers;

use KbitArchitect\Core\Database;
use KbitArchitect\Models\User;
use KbitArchitect\Models\QuotaManager;
use KbitArchitect\Models\CostController;

class UserController
{
    private User $userModel;
    private QuotaManager $quotaManager;
    private CostController $costController;
    private Database $db;

    public function __construct()
    {
        $this->userModel = new User();
        $this->quotaManager = new QuotaManager();
        $this->costController = new CostController();
        $this->db = Database::getInstance();
    }

    public function getProfile(array $request): array
    {
        $userId = $GLOBALS['auth_user']['id'] ?? null;
        
        if (!$userId) {
            return ['success' => false, 'error' => '未授权', 'code' => 401];
        }

        $user = $this->userModel->findById($userId);
        
        if (!$user) {
            return ['success' => false, 'error' => '用户不存在', 'code' => 404];
        }

        unset($user['password_hash']);

        $tierConfig = $this->userModel->getTierConfig($user['user_tier']);

        return [
            'success' => true,
            'data' => [
                'user' => $user,
                'tier_config' => $tierConfig
            ]
        ];
    }

    public function getQuota(array $request): array
    {
        $userId = $GLOBALS['auth_user']['id'] ?? null;
        
        if (!$userId) {
            return ['success' => false, 'error' => '未授权', 'code' => 401];
        }

        $quotaInfo = $this->quotaManager->getUserQuotaInfo($userId);

        return [
            'success' => true,
            'data' => $quotaInfo
        ];
    }

    public function getUsageStats(array $request): array
    {
        $userId = $GLOBALS['auth_user']['id'] ?? null;
        
        if (!$userId) {
            return ['success' => false, 'error' => '未授权', 'code' => 401];
        }

        $period = $request['query']['period'] ?? 'today';

        $stats = $this->userModel->getUsageStats($userId, $period);

        $byFeature = $this->db->query(
            "SELECT feature, 
                    COUNT(*) as count,
                    SUM(points_cost) as points,
                    SUM(total_tokens) as tokens
             FROM usage_logs 
             WHERE user_id = ? AND DATE(created_at) = CURDATE() AND status = 'success'
             GROUP BY feature",
            [$userId]
        );

        return [
            'success' => true,
            'data' => [
                'summary' => $stats,
                'by_feature' => $byFeature
            ]
        ];
    }

    public function getTransactionHistory(array $request): array
    {
        $userId = $GLOBALS['auth_user']['id'] ?? null;
        
        if (!$userId) {
            return ['success' => false, 'error' => '未授权', 'code' => 401];
        }

        $page = (int) ($request['query']['page'] ?? 1);
        $limit = (int) ($request['query']['limit'] ?? 20);
        $offset = ($page - 1) * $limit;

        $transactions = $this->db->query(
            'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
            [$userId, $limit, $offset]
        );

        $total = $this->db->queryOne(
            'SELECT COUNT(*) as count FROM transactions WHERE user_id = ?',
            [$userId]
        );

        return [
            'success' => true,
            'data' => [
                'transactions' => $transactions,
                'pagination' => [
                    'page' => $page,
                    'limit' => $limit,
                    'total' => $total['count'] ?? 0,
                    'total_pages' => ceil(($total['count'] ?? 0) / $limit)
                ]
            ]
        ];
    }

    public function purchasePoints(array $request): array
    {
        $userId = $GLOBALS['auth_user']['id'] ?? null;
        
        if (!$userId) {
            return ['success' => false, 'error' => '未授权', 'code' => 401];
        }

        $amount = (float) ($request['body']['amount'] ?? 0);
        $paymentMethod = $request['body']['payment_method'] ?? 'alipay';

        if ($amount <= 0) {
            return ['success' => false, 'error' => '充值金额无效', 'code' => 400];
        }

        $pointsPackages = [
            100 => 100,
            500 => 550,
            1000 => 1200,
            2000 => 2600,
            5000 => 7000,
            10000 => 15000
        ];

        $points = $pointsPackages[$amount] ?? $amount;

        $transactionId = 'TOPUP-' . date('YmdHis') . '-' . bin2hex(random_bytes(4));

        $success = $this->userModel->addPurchasedPoints($userId, $points, $transactionId);

        return [
            'success' => $success,
            'message' => $success ? "成功充值 {$points} 积分" : '充值失败',
            'data' => [
                'transaction_id' => $transactionId,
                'amount' => $amount,
                'points' => $points,
                'new_balance' => $this->userModel->getTotalPoints($userId)
            ]
        ];
    }
}
