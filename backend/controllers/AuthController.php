<?php
/**
 * 首席图像架构师 - 认证控制器
 * 
 * @package KbitArchitect
 * @version 1.0.0
 */

namespace KbitArchitect\Controllers;

use KbitArchitect\Core\JWT;
use KbitArchitect\Core\Database;
use KbitArchitect\Models\User;

class AuthController
{
    private User $userModel;
    private Database $db;

    public function __construct()
    {
        $this->userModel = new User();
        $this->db = Database::getInstance();
    }

    public function register(array $request): array
    {
        $email = trim($request['body']['email'] ?? '');
        $password = $request['body']['password'] ?? '';
        $nickname = trim($request['body']['nickname'] ?? '');
        $phone = trim($request['body']['phone'] ?? '');

        if (empty($email) || empty($password)) {
            return ['success' => false, 'error' => '邮箱和密码不能为空', 'code' => 400];
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return ['success' => false, 'error' => '邮箱格式不正确', 'code' => 400];
        }

        if (strlen($password) < 6) {
            return ['success' => false, 'error' => '密码长度至少6位', 'code' => 400];
        }

        $existingUser = $this->userModel->findByEmail($email);
        if ($existingUser) {
            return ['success' => false, 'error' => '该邮箱已被注册', 'code' => 400];
        }

        if (!empty($phone)) {
            $existingPhone = $this->userModel->findByPhone($phone);
            if ($existingPhone) {
                return ['success' => false, 'error' => '该手机号已被使用', 'code' => 400];
            }
        }

        try {
            $userId = $this->userModel->create([
                'email' => $email,
                'password' => $password,
                'nickname' => $nickname ?: null,
                'phone' => $phone ?: null
            ]);

            $tokens = JWT::generateTokenPair($userId, 'free');
            
            $this->userModel->updateLastLogin($userId, $request['ip']);

            return [
                'success' => true,
                'message' => '注册成功',
                'data' => [
                    'user' => $this->userModel->findById($userId),
                    'tokens' => $tokens
                ]
            ];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => '注册失败: ' . $e->getMessage(), 'code' => 500];
        }
    }

    public function login(array $request): array
    {
        $email = trim($request['body']['email'] ?? '');
        $password = $request['body']['password'] ?? '';

        if (empty($email) || empty($password)) {
            return ['success' => false, 'error' => '邮箱和密码不能为空', 'code' => 400];
        }

        $user = $this->userModel->findByEmail($email);
        
        if (!$user) {
            return ['success' => false, 'error' => '邮箱或密码错误', 'code' => 401];
        }

        if ($user['status'] != 1) {
            return ['success' => false, 'error' => '账户已被禁用', 'code' => 403];
        }

        if (!password_verify($password, $user['password_hash'])) {
            return ['success' => false, 'error' => '邮箱或密码错误', 'code' => 401];
        }

        $tokens = JWT::generateTokenPair($user['id'], $user['user_tier']);
        
        $this->userModel->updateLastLogin($user['id'], $request['ip']);

        unset($user['password_hash']);

        return [
            'success' => true,
            'message' => '登录成功',
            'data' => [
                'user' => $user,
                'tokens' => $tokens
            ]
        ];
    }

    public function logout(array $request): array
    {
        $authHeader = $request['headers']['Authorization'] ?? '';
        $token = JWT::extractFromHeader($authHeader);

        if ($token) {
            JWT::invalidate($token);
        }

        return [
            'success' => true,
            'message' => '已退出登录'
        ];
    }

    public function refresh(array $request): array
    {
        $refreshToken = $request['body']['refresh_token'] ?? '';

        if (empty($refreshToken)) {
            return ['success' => false, 'error' => '刷新令牌不能为空', 'code' => 400];
        }

        try {
            $payload = JWT::decode($refreshToken);
            
            if (($payload['type'] ?? '') !== 'refresh') {
                return ['success' => false, 'error' => '无效的刷新令牌', 'code' => 401];
            }

            $userId = $payload['sub'];
            $user = $this->userModel->findById($userId);

            if (!$user || $user['status'] != 1) {
                return ['success' => false, 'error' => '用户不存在或已被禁用', 'code' => 401];
            }

            JWT::invalidate($refreshToken);

            $tokens = JWT::generateTokenPair($userId, $user['user_tier']);

            return [
                'success' => true,
                'data' => [
                    'tokens' => $tokens
                ]
            ];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => '刷新令牌无效或已过期', 'code' => 401];
        }
    }

    public function me(array $request): array
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

        return [
            'success' => true,
            'data' => $user
        ];
    }

    public function updateProfile(array $request): array
    {
        $userId = $GLOBALS['auth_user']['id'] ?? null;
        
        if (!$userId) {
            return ['success' => false, 'error' => '未授权', 'code' => 401];
        }

        $allowedFields = ['nickname', 'avatar_url', 'phone'];
        $updateData = [];
        
        foreach ($allowedFields as $field) {
            if (isset($request['body'][$field])) {
                $updateData[$field] = $request['body'][$field];
            }
        }

        if (empty($updateData)) {
            return ['success' => false, 'error' => '没有要更新的数据', 'code' => 400];
        }

        if (isset($updateData['phone'])) {
            $existing = $this->userModel->findByPhone($updateData['phone']);
            if ($existing && $existing['id'] != $userId) {
                return ['success' => false, 'error' => '该手机号已被使用', 'code' => 400];
            }
        }

        $success = $this->userModel->update($userId, $updateData);

        return [
            'success' => $success,
            'message' => $success ? '更新成功' : '更新失败',
            'data' => $this->userModel->findById($userId)
        ];
    }

    public function changePassword(array $request): array
    {
        $userId = $GLOBALS['auth_user']['id'] ?? null;
        
        if (!$userId) {
            return ['success' => false, 'error' => '未授权', 'code' => 401];
        }

        $oldPassword = $request['body']['old_password'] ?? '';
        $newPassword = $request['body']['new_password'] ?? '';

        if (empty($oldPassword) || empty($newPassword)) {
            return ['success' => false, 'error' => '请填写完整信息', 'code' => 400];
        }

        if (strlen($newPassword) < 6) {
            return ['success' => false, 'error' => '新密码长度至少6位', 'code' => 400];
        }

        if (!$this->userModel->verifyPassword($userId, $oldPassword)) {
            return ['success' => false, 'error' => '原密码错误', 'code' => 400];
        }

        $success = $this->userModel->updatePassword($userId, $newPassword);

        return [
            'success' => $success,
            'message' => $success ? '密码修改成功' : '密码修改失败'
        ];
    }

    public function sendVerificationCode(array $request): array
    {
        $target = trim($request['body']['email'] ?? $request['body']['phone'] ?? '');
        $type = filter_var($target, FILTER_VALIDATE_EMAIL) ? 'email' : 'phone';

        if (empty($target)) {
            return ['success' => false, 'error' => '请提供邮箱或手机号', 'code' => 400];
        }

        $code = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $expiresAt = date('Y-m-d H:i:s', time() + 300);

        $this->db->insert('verification_codes', [
            'target' => $target,
            'code' => $code,
            'type' => $type,
            'expires_at' => $expiresAt
        ]);

        return [
            'success' => true,
            'message' => "验证码已发送至{$type}",
            'data' => [
                'expires_in' => 300,
                'type' => $type
            ]
        ];
    }

    public function verifyCode(array $request): array
    {
        $target = trim($request['body']['email'] ?? $request['body']['phone'] ?? '');
        $code = trim($request['body']['code'] ?? '');

        if (empty($target) || empty($code)) {
            return ['success' => false, 'error' => '请提供完整信息', 'code' => 400];
        }

        $record = $this->db->queryOne(
            'SELECT * FROM verification_codes 
             WHERE target = ? AND code = ? AND is_used = 0 AND expires_at > NOW()
             ORDER BY created_at DESC LIMIT 1',
            [$target, $code]
        );

        if (!$record) {
            return ['success' => false, 'error' => '验证码无效或已过期', 'code' => 400];
        }

        $this->db->update('verification_codes', ['is_used' => 1], ['id' => $record['id']]);

        $userId = $GLOBALS['auth_user']['id'] ?? null;
        if ($userId) {
            if ($record['type'] === 'email') {
                $this->userModel->verifyEmail($userId);
            } else {
                $this->userModel->verifyPhone($userId);
            }
        }

        return [
            'success' => true,
            'message' => '验证成功'
        ];
    }

    public function resetPassword(array $request): array
    {
        $email = trim($request['body']['email'] ?? '');
        $code = trim($request['body']['code'] ?? '');
        $newPassword = $request['body']['new_password'] ?? '';

        if (empty($email) || empty($code) || empty($newPassword)) {
            return ['success' => false, 'error' => '请填写完整信息', 'code' => 400];
        }

        if (strlen($newPassword) < 6) {
            return ['success' => false, 'error' => '密码长度至少6位', 'code' => 400];
        }

        $record = $this->db->queryOne(
            'SELECT * FROM verification_codes
             WHERE target = ? AND code = ? AND type = "password_reset" AND is_used = 0 AND expires_at > NOW()
             ORDER BY created_at DESC LIMIT 1',
            [$email, $code]
        );

        if (!$record) {
            return ['success' => false, 'error' => '验证码无效或已过期', 'code' => 400];
        }

        $user = $this->userModel->findByEmail($email);
        if (!$user) {
            return ['success' => false, 'error' => '用户不存在', 'code' => 404];
        }

        $this->userModel->updatePassword($user['id'], $newPassword);
        $this->db->update('verification_codes', ['is_used' => 1], ['id' => $record['id']]);

        return [
            'success' => true,
            'message' => '密码重置成功'
        ];
    }

    public function verifyInviteCode(array $request): array
    {
        try {
            error_log('=== 开始验证邀请码 ===');

            $inviteCode = trim($request['body']['invite_code'] ?? '');

            error_log("邀请码: $inviteCode");

            if (empty($inviteCode)) {
                return ['success' => false, 'error' => '邀请码不能为空', 'code' => 400];
            }

            error_log('开始查询邀请码');
            $invite = $this->db->queryOne(
                'SELECT * FROM invite_codes WHERE code = ? AND status = "active" AND (expires_at IS NULL OR expires_at > NOW())',
                [$inviteCode]
            );

            if (!$invite) {
                return ['success' => false, 'error' => '邀请码无效或已过期', 'code' => 400];
            }

            if ($invite['max_uses'] > 0 && $invite['current_uses'] >= $invite['max_uses']) {
                return ['success' => false, 'error' => '邀请码已达到使用上限', 'code' => 400];
            }

            error_log('邀请码验证成功');
            return [
                'success' => true,
                'message' => '邀请码验证成功',
                'data' => [
                    'points_bonus' => $invite['points_bonus'] ?? 0
                ]
            ];
        } catch (\Exception $e) {
            error_log('邀请码验证错误: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
            error_log('堆栈: ' . $e->getTraceAsString());
            return ['success' => false, 'error' => '验证失败: ' . $e->getMessage(), 'code' => 500];
        }
    }

    public function registerWithInvite(array $request): array
    {
        try {
            error_log('=== 开始邀请码注册 ===');

            $email = trim($request['body']['email'] ?? '');
            $password = $request['body']['password'] ?? '';
            $inviteCode = trim($request['body']['invite_code'] ?? '');

            error_log("邮箱: $email, 邀请码: $inviteCode");

            if (empty($email) || empty($password) || empty($inviteCode)) {
                return ['success' => false, 'error' => '邮箱、密码和邀请码不能为空', 'code' => 400];
            }

            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                return ['success' => false, 'error' => '邮箱格式不正确', 'code' => 400];
            }

            if (strlen($password) < 6) {
                return ['success' => false, 'error' => '密码长度至少6位', 'code' => 400];
            }

            error_log('开始检查邮箱是否存在');
            $existingUser = $this->userModel->findByEmail($email);
            if ($existingUser) {
                return ['success' => false, 'error' => '该邮箱已被注册', 'code' => 400];
            }

            error_log('开始查询邀请码');
            $invite = $this->db->queryOne(
                'SELECT * FROM invite_codes WHERE code = ? AND status = "active" AND (expires_at IS NULL OR expires_at > NOW())',
                [$inviteCode]
            );

            if (!$invite) {
                return ['success' => false, 'error' => '邀请码无效或已过期', 'code' => 400];
            }

            if ($invite['max_uses'] > 0 && $invite['current_uses'] >= $invite['max_uses']) {
                return ['success' => false, 'error' => '邀请码已达到使用上限', 'code' => 400];
            }

            error_log('开始创建用户');
            $userId = $this->userModel->create([
                'email' => $email,
                'password' => $password,
                'nickname' => null
            ]);
            error_log("用户创建成功，ID: $userId");

            // 升级为 Beta 用户并赠送积分
            error_log('升级用户为 Beta 等级');
            $this->db->update('kbit_users', [
                'user_tier' => 'beta',
                'purchased_points' => $invite['points_bonus'] ?? 1000
            ], ['id' => $userId]);

            // 记录积分赠送交易
            $this->db->insert('transactions', [
                'user_id' => $userId,
                'type' => 'bonus',
                'amount' => $invite['points_bonus'] ?? 1000,
                'balance_before' => 0,
                'balance_after' => $invite['points_bonus'] ?? 1000,
                'source' => 'invite_code',
                'reference_id' => $inviteCode,
                'description' => '邀请码注册赠送积分'
            ]);

            error_log('更新邀请码使用次数');
            $this->db->update('invite_codes', [
                'current_uses' => $invite['current_uses'] + 1,
                'used_by' => $email,
                'used_at' => date('Y-m-d H:i:s')
            ], ['id' => $invite['id']]);

            error_log('生成JWT令牌');
            $tokens = JWT::generateTokenPair($userId, 'beta');

            error_log('更新最后登录时间');
            $this->userModel->updateLastLogin($userId, $request['ip']);

            error_log('注册成功');
            return [
                'success' => true,
                'message' => '注册成功',
                'data' => [
                    'user' => $this->userModel->findById($userId),
                    'tokens' => $tokens
                ]
            ];
        } catch (\Exception $e) {
            error_log('邀请码注册错误: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
            error_log('堆栈: ' . $e->getTraceAsString());
            return ['success' => false, 'error' => '注册失败: ' . $e->getMessage(), 'code' => 500];
        }
    }
}
