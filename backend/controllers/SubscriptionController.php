<?php
/**
 * 首席图像架构师 - 订阅控制器
 * 
 * @package KbitArchitect
 * @version 1.0.0
 */

namespace KbitArchitect\Controllers;

use KbitArchitect\Core\Database;
use KbitArchitect\Models\User;
use KbitArchitect\Models\Subscription;

class SubscriptionController
{
    private Subscription $subscriptionModel;
    private User $userModel;
    private Database $db;

    public function __construct()
    {
        $this->subscriptionModel = new Subscription();
        $this->userModel = new User();
        $this->db = Database::getInstance();
    }

    public function getPlans(array $request): array
    {
        $plans = $this->subscriptionModel->getPlans();

        $plans = array_map(function ($plan) {
            unset($plan['is_active'], $plan['sort_order']);
            $plan['features'] = json_decode($plan['features'] ?? '{}', true);
            return $plan;
        }, $plans);

        return [
            'success' => true,
            'data' => [
                'plans' => $plans
            ]
        ];
    }

    public function subscribe(array $request): array
    {
        $userId = $GLOBALS['auth_user']['id'] ?? null;
        
        if (!$userId) {
            return ['success' => false, 'error' => '未授权', 'code' => 401];
        }

        $tierCode = $request['body']['tier'] ?? '';
        $billingCycle = $request['body']['billing_cycle'] ?? 'monthly';
        $paymentMethod = $request['body']['payment_method'] ?? 'alipay';

        $validTiers = ['basic', 'pro', 'plus'];
        if (!in_array($tierCode, $validTiers)) {
            return ['success' => false, 'error' => '无效的订阅等级', 'code' => 400];
        }

        $validCycles = ['monthly', 'quarterly', 'yearly'];
        if (!in_array($billingCycle, $validCycles)) {
            return ['success' => false, 'error' => '无效的计费周期', 'code' => 400];
        }

        try {
            $subscriptionId = $this->subscriptionModel->create(
                $userId,
                $tierCode,
                $billingCycle,
                $paymentMethod
            );

            $subscription = $this->db->queryOne(
                'SELECT * FROM subscriptions WHERE id = ?',
                [$subscriptionId]
            );

            return [
                'success' => true,
                'message' => '订阅成功',
                'data' => [
                    'subscription' => $subscription,
                    'user' => $this->userModel->findById($userId)
                ]
            ];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => '订阅失败: ' . $e->getMessage(), 'code' => 500];
        }
    }

    public function activateLicense(array $request): array
    {
        $userId = $GLOBALS['auth_user']['id'] ?? null;
        
        if (!$userId) {
            return ['success' => false, 'error' => '未授权', 'code' => 401];
        }

        $licenseKey = trim($request['body']['license_key'] ?? '');

        if (empty($licenseKey)) {
            return ['success' => false, 'error' => '请输入授权口令', 'code' => 400];
        }

        $result = $this->subscriptionModel->applyLicenseKey($userId, $licenseKey);

        if ($result['success']) {
            $result['data'] = [
                'user' => $this->userModel->findById($userId)
            ];
        }

        return $result;
    }

    public function getCurrentSubscription(array $request): array
    {
        $userId = $GLOBALS['auth_user']['id'] ?? null;
        
        if (!$userId) {
            return ['success' => false, 'error' => '未授权', 'code' => 401];
        }

        $subscription = $this->subscriptionModel->getUserActiveSubscription($userId);

        return [
            'success' => true,
            'data' => [
                'subscription' => $subscription
            ]
        ];
    }

    public function getHistory(array $request): array
    {
        $userId = $GLOBALS['auth_user']['id'] ?? null;
        
        if (!$userId) {
            return ['success' => false, 'error' => '未授权', 'code' => 401];
        }

        $limit = (int) ($request['query']['limit'] ?? 10);
        $history = $this->subscriptionModel->getUserSubscriptionHistory($userId, $limit);

        return [
            'success' => true,
            'data' => [
                'history' => $history
            ]
        ];
    }

    public function cancel(array $request): array
    {
        $userId = $GLOBALS['auth_user']['id'] ?? null;
        
        if (!$userId) {
            return ['success' => false, 'error' => '未授权', 'code' => 401];
        }

        $subscriptionId = (int) ($request['body']['subscription_id'] ?? 0);

        if ($subscriptionId <= 0) {
            return ['success' => false, 'error' => '无效的订阅ID', 'code' => 400];
        }

        $success = $this->subscriptionModel->cancel($subscriptionId, $userId);

        return [
            'success' => $success,
            'message' => $success ? '已取消自动续费' : '取消失败，请稍后重试'
        ];
    }

    public function checkUpgrade(array $request): array
    {
        $userId = $GLOBALS['auth_user']['id'] ?? null;
        
        if (!$userId) {
            return ['success' => false, 'error' => '未授权', 'code' => 401];
        }

        $user = $this->userModel->findById($userId);
        $currentTier = $user['user_tier'] ?? 'free';
        
        $tierOrder = ['free' => 0, 'basic' => 1, 'pro' => 2, 'plus' => 3];
        $currentLevel = $tierOrder[$currentTier] ?? 0;

        $plans = $this->subscriptionModel->getPlans();
        
        $upgrades = array_filter($plans, function ($plan) use ($tierOrder, $currentLevel) {
            return ($tierOrder[$plan['tier_code']] ?? 0) > $currentLevel;
        });

        return [
            'success' => true,
            'data' => [
                'current_tier' => $currentTier,
                'available_upgrades' => array_values($upgrades)
            ]
        ];
    }
}
