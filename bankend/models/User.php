<?php
/**
 * 首席图像架构师 - 用户模型
 * 
 * @package KbitArchitect
 * @version 1.0.0
 */

namespace KbitArchitect\Models;

use KbitArchitect\Core\Database;
use RuntimeException;

class User
{
    private Database $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    public function findById(int $id): ?array
    {
        return $this->db->queryOne(
            'SELECT id, email, nickname, avatar_url, user_tier, tier_expires_at,
                    daily_points, purchased_points, total_consumed_points, status,
                    email_verified, last_login_at, created_at
             FROM kbit_users WHERE id = ?',
            [$id]
        );
    }

    public function findByEmail(string $email): ?array
    {
        return $this->db->queryOne(
            'SELECT * FROM kbit_users WHERE email = ?',
            [$email]
        );
    }

    public function findByPhone(string $phone): ?array
    {
        return null;
    }

    public function create(array $data): int
    {
        $config = require __DIR__ . '/../config/system.php';
        $passwordHash = password_hash(
            $data['password'],
            $config['security']['password_algo'],
            $config['security']['password_options']
        );

        $userId = $this->db->insert('kbit_users', [
            'email' => $data['email'],
            'password_hash' => $passwordHash,
            'nickname' => $data['nickname'] ?? $this->generateNickname($data['email']),
            'user_tier' => 'free',
            'daily_points' => 1000,
            'purchased_points' => 0,
            'status' => 1,
            'email_verified' => 0
        ]);

        // $this->recordTransaction($userId, 'earn', 1000, 'daily_reset', '新用户注册赠送');

        return $userId;
    }

    public function update(int $id, array $data): bool
    {
        $allowedFields = ['nickname', 'avatar_url', 'phone'];
        $updateData = array_intersect_key($data, array_flip($allowedFields));
        
        if (empty($updateData)) {
            return false;
        }

        return $this->db->update('kbit_users', $updateData, ['id' => $id]) > 0;
    }

    public function updatePassword(int $id, string $newPassword): bool
    {
        $config = require __DIR__ . '/../config/system.php';
        $passwordHash = password_hash(
            $newPassword,
            $config['security']['password_algo'],
            $config['security']['password_options']
        );

        return $this->db->update('kbit_users', ['password_hash' => $passwordHash], ['id' => $id]) > 0;
    }

    public function verifyPassword(int $id, string $password): bool
    {
        $user = $this->db->queryOne('SELECT password_hash FROM kbit_users WHERE id = ?', [$id]);
        
        if (!$user) {
            return false;
        }

        return password_verify($password, $user['password_hash']);
    }

    public function verifyEmail(int $id): bool
    {
        return $this->db->update('kbit_users', ['email_verified' => 1], ['id' => $id]) > 0;
    }

    public function verifyPhone(int $id): bool
    {
        return $this->db->update('kbit_users', ['phone_verified' => 1], ['id' => $id]) > 0;
    }

    public function updateLastLogin(int $id, string $ip): void
    {
        $this->db->update('kbit_users', [
            'last_login_at' => date('Y-m-d H:i:s'),
            'last_login_ip' => $ip
        ], ['id' => $id]);
    }

    public function updateTier(int $id, string $tier, ?string $expiresAt = null): bool
    {
        return $this->db->update('kbit_users', [
            'user_tier' => $tier,
            'tier_expires_at' => $expiresAt
        ], ['id' => $id]) > 0;
    }

    public function getTierConfig(string $tier): ?array
    {
        return $this->db->queryOne(
            'SELECT * FROM tiers WHERE tier_code = ? AND is_active = 1',
            [$tier]
        );
    }

    public function getTotalPoints(int $id): float
    {
        $user = $this->findById($id);
        if (!$user) {
            return 0;
        }
        return (float) $user['daily_points'] + (float) $user['purchased_points'];
    }

    public function deductPoints(int $id, float $amount, string $source, ?string $referenceId = null, ?string $description = null): bool
    {
        $user = $this->findById($id);
        if (!$user) {
            return false;
        }

        $totalPoints = (float) $user['daily_points'] + (float) $user['purchased_points'];
        
        if ($totalPoints < $amount) {
            return false;
        }

        $this->db->beginTransaction();

        try {
            $dailyDeduct = min($user['daily_points'], $amount);
            $purchasedDeduct = $amount - $dailyDeduct;

            $newDaily = $user['daily_points'] - $dailyDeduct;
            $newPurchased = $user['purchased_points'] - $purchasedDeduct;

            $this->db->update('kbit_users', [
                'daily_points' => $newDaily,
                'purchased_points' => $newPurchased,
                'total_consumed_points' => $user['total_consumed_points'] + $amount
            ], ['id' => $id]);

            $this->recordTransaction($id, 'spend', -$amount, $source, $description, $referenceId);

            $this->db->commit();
            return true;
        } catch (\Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    public function refundPoints(int $id, float $amount, string $source, ?string $referenceId = null, ?string $description = null): bool
    {
        $user = $this->findById($id);
        if (!$user) {
            return false;
        }

        $this->db->beginTransaction();

        try {
            $this->db->update('kbit_users', [
                'purchased_points' => $user['purchased_points'] + $amount,
                'total_consumed_points' => max(0, $user['total_consumed_points'] - $amount)
            ], ['id' => $id]);

            $this->recordTransaction($id, 'refund', $amount, $source, $description, $referenceId);

            $this->db->commit();
            return true;
        } catch (\Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    public function addPurchasedPoints(int $id, float $amount, ?string $referenceId = null): bool
    {
        $user = $this->findById($id);
        if (!$user) {
            return false;
        }

        $this->db->beginTransaction();

        try {
            $this->db->update('kbit_users', [
                'purchased_points' => $user['purchased_points'] + $amount
            ], ['id' => $id]);

            $this->recordTransaction($id, 'purchase', $amount, 'purchase', '购买积分', $referenceId);

            $this->db->commit();
            return true;
        } catch (\Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    private function recordTransaction(int $userId, string $type, float $amount, string $source, ?string $description = null, ?string $referenceId = null): void
    {
        $user = $this->findById($userId);
        $balanceBefore = $user ? ((float) $user['daily_points'] + (float) $user['purchased_points']) : 0;
        $balanceAfter = $balanceBefore + $amount;

        $this->db->insert('transactions', [
            'user_id' => $userId,
            'type' => $type,
            'amount' => $amount,
            'balance_before' => $balanceBefore,
            'balance_after' => $balanceAfter,
            'source' => $source,
            'reference_id' => $referenceId,
            'description' => $description
        ]);
    }

    private function generateNickname(string $email): string
    {
        $prefix = explode('@', $email)[0];
        return $prefix . '_' . substr(md5(time()), 0, 6);
    }

    public function getUsageStats(int $id, string $period = 'today'): array
    {
        $whereClause = match ($period) {
            'today' => 'DATE(created_at) = CURDATE()',
            'week' => 'created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)',
            'month' => 'created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)',
            default => 'DATE(created_at) = CURDATE()'
        };

        return $this->db->queryOne(
            "SELECT 
                COUNT(*) as total_requests,
                SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_requests,
                SUM(points_cost) as total_points_spent,
                SUM(prompt_tokens) as total_prompt_tokens,
                SUM(completion_tokens) as total_completion_tokens
             FROM usage_logs 
             WHERE user_id = ? AND {$whereClause}",
            [$id]
        ) ?: [];
    }
}
