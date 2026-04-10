<?php
/**
 * 首席图像架构师 - 订阅模型
 * 
 * @package KbitArchitect
 * @version 1.0.0
 */

namespace KbitArchitect\Models;

use KbitArchitect\Core\Database;
use RuntimeException;

class Subscription
{
    private Database $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    public function getPlans(): array
    {
        return $this->db->query(
            'SELECT * FROM tiers WHERE is_active = 1 ORDER BY sort_order ASC'
        );
    }

    public function getPlanByCode(string $tierCode): ?array
    {
        return $this->db->queryOne(
            'SELECT * FROM tiers WHERE tier_code = ? AND is_active = 1',
            [$tierCode]
        );
    }

    public function create(int $userId, string $tierCode, string $billingCycle, ?string $paymentMethod = null, ?string $transactionId = null): int
    {
        $plan = $this->getPlanByCode($tierCode);
        if (!$plan) {
            throw new RuntimeException('Invalid subscription plan');
        }

        $amount = match ($billingCycle) {
            'monthly' => $plan['price_monthly'],
            'quarterly' => $plan['price_quarterly'],
            'yearly' => $plan['price_yearly'],
            default => $plan['price_monthly']
        };

        $durationMonths = match ($billingCycle) {
            'monthly' => 1,
            'quarterly' => 3,
            'yearly' => 12,
            default => 1
        };

        $startedAt = date('Y-m-d H:i:s');
        $expiresAt = date('Y-m-d H:i:s', strtotime("+{$durationMonths} months"));

        $subscriptionId = $this->db->insert('subscriptions', [
            'user_id' => $userId,
            'tier_code' => $tierCode,
            'billing_cycle' => $billingCycle,
            'amount' => $amount,
            'currency' => 'CNY',
            'status' => 'active',
            'payment_method' => $paymentMethod,
            'payment_transaction_id' => $transactionId,
            'started_at' => $startedAt,
            'expires_at' => $expiresAt,
            'auto_renew' => 1
        ]);

        $userModel = new User();
        $userModel->updateTier($userId, $tierCode, $expiresAt);

        $userModel->addPurchasedPoints($userId, $plan['daily_points'] * $durationMonths, "SUB-{$subscriptionId}");

        return $subscriptionId;
    }

    public function cancel(int $subscriptionId, int $userId): bool
    {
        $subscription = $this->db->queryOne(
            'SELECT * FROM subscriptions WHERE id = ? AND user_id = ? AND status = "active"',
            [$subscriptionId, $userId]
        );

        if (!$subscription) {
            return false;
        }

        $this->db->update('subscriptions', [
            'auto_renew' => 0,
            'cancelled_at' => date('Y-m-d H:i:s')
        ], ['id' => $subscriptionId]);

        return true;
    }

    public function getUserActiveSubscription(int $userId): ?array
    {
        return $this->db->queryOne(
            'SELECT * FROM subscriptions WHERE user_id = ? AND status = "active" AND expires_at > NOW() ORDER BY expires_at DESC LIMIT 1',
            [$userId]
        );
    }

    public function getUserSubscriptionHistory(int $userId, int $limit = 10): array
    {
        return $this->db->query(
            'SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
            [$userId, $limit]
        );
    }

    public function renew(int $subscriptionId): bool
    {
        $subscription = $this->db->queryOne(
            'SELECT * FROM subscriptions WHERE id = ? AND auto_renew = 1 AND status = "active"',
            [$subscriptionId]
        );

        if (!$subscription) {
            return false;
        }

        return $this->create(
            $subscription['user_id'],
            $subscription['tier_code'],
            $subscription['billing_cycle'],
            $subscription['payment_method']
        ) > 0;
    }

    public function checkExpired(): int
    {
        $expired = $this->db->query(
            'SELECT id, user_id FROM subscriptions WHERE status = "active" AND expires_at < NOW()'
        );

        $count = 0;
        foreach ($expired as $sub) {
            $this->db->update('subscriptions', ['status' => 'expired'], ['id' => $sub['id']]);
            
            $activeSubscription = $this->getUserActiveSubscription($sub['user_id']);
            if (!$activeSubscription) {
                $userModel = new User();
                $userModel->updateTier($sub['user_id'], 'free', null);
            }
            $count++;
        }

        return $count;
    }

    public function applyLicenseKey(int $userId, string $licenseKey): array
    {
        $validKeys = [
            'KBIT-BASIC-2025' => ['tier' => 'basic', 'cycle' => 'monthly', 'months' => 1],
            'KBIT-PRO-2025' => ['tier' => 'pro', 'cycle' => 'monthly', 'months' => 1],
            'KBIT-PLUS-2025' => ['tier' => 'plus', 'cycle' => 'monthly', 'months' => 1],
            'KBIT-BASIC-2025-Y' => ['tier' => 'basic', 'cycle' => 'yearly', 'months' => 12],
            'KBIT-PRO-2025-Y' => ['tier' => 'pro', 'cycle' => 'yearly', 'months' => 12],
            'KBIT-PLUS-2025-Y' => ['tier' => 'plus', 'cycle' => 'yearly', 'months' => 12],
        ];

        $key = strtoupper(trim($licenseKey));
        
        if (!isset($validKeys[$key])) {
            return ['success' => false, 'error' => '无效的授权口令'];
        }

        $keyInfo = $validKeys[$key];
        
        $existing = $this->db->queryOne(
            'SELECT * FROM subscriptions WHERE user_id = ? AND payment_transaction_id = ?',
            [$userId, $key]
        );

        if ($existing) {
            return ['success' => false, 'error' => '该授权口令已被使用'];
        }

        try {
            $subscriptionId = $this->create(
                $userId,
                $keyInfo['tier'],
                $keyInfo['cycle'],
                'license_key',
                $key
            );

            return [
                'success' => true,
                'subscription_id' => $subscriptionId,
                'tier' => $keyInfo['tier'],
                'expires_at' => date('Y-m-d H:i:s', strtotime("+{$keyInfo['months']} months"))
            ];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => '激活失败: ' . $e->getMessage()];
        }
    }
}
