<?php
/**
 * 首席图像架构师 - 管理后台控制器
 * 
 * @package KbitArchitect
 * @version 1.0.0
 */

namespace KbitArchitect\Controllers;

use KbitArchitect\Core\Database;
use KbitArchitect\Core\Mailer;
use KbitArchitect\Models\User;
use KbitArchitect\Models\ModelRouter;
use KbitArchitect\Models\CostController;

class AdminController
{
    private Database $db;
    private User $userModel;
    private ModelRouter $modelRouter;
    private CostController $costController;

    public function __construct()
    {
        $this->db = Database::getInstance();
        $this->userModel = new User();
        $this->modelRouter = new ModelRouter();
        $this->costController = new CostController();
    }

    private function checkAdmin(): bool
    {
        $userId = $GLOBALS['auth_user']['id'] ?? null;
        if (!$userId) {
            return false;
        }
        
        $admin = $this->db->queryOne(
            'SELECT * FROM admins WHERE id = ?',
            [$userId]
        );
        
        return $admin !== null;
    }

    public function login(array $request): array
    {
        $username = trim($request['body']['username'] ?? '');
        $password = $request['body']['password'] ?? '';

        if (empty($username) || empty($password)) {
            return ['success' => false, 'error' => '用户名和密码不能为空', 'code' => 400];
        }

        $admin = $this->db->queryOne(
            'SELECT * FROM admins WHERE username = ?',
            [$username]
        );

        if (!$admin || !password_verify($password, $admin['password_hash'])) {
            return ['success' => false, 'error' => '用户名或密码错误', 'code' => 401];
        }

        $this->db->update('admins', [
            'last_login_at' => date('Y-m-d H:i:s'),
            'last_login_ip' => $request['ip']
        ], ['id' => $admin['id']]);

        unset($admin['password_hash']);

        // 生成 JWT token
        $token = \KbitArchitect\Core\JWT::encode([
            'sub' => $admin['id'],
            'type' => 'access',
            'tier' => 'admin',
            'jti' => bin2hex(random_bytes(16)),
            'exp' => time() + 3600 * 24 // 24小时过期
        ]);

        return [
            'success' => true,
            'message' => '登录成功',
            'data' => [
                'admin' => $admin,
                'token' => $token
            ]
        ];
    }

    public function getDashboard(array $request): array
    {
        if (!$this->checkAdmin()) {
            return ['success' => false, 'error' => '无权限', 'code' => 403];
        }

        $userCount = $this->db->queryOne('SELECT COUNT(*) as count FROM kbit_users');
        $activeUsers = $this->db->queryOne(
            'SELECT COUNT(*) as count FROM kbit_users WHERE created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)'
        );
        $todayRequests = $this->db->queryOne(
            'SELECT COUNT(*) as count FROM token_usage WHERE DATE(created_at) = CURDATE()'
        );
        $todayCost = $this->db->queryOne(
            'SELECT COALESCE(SUM(total_tokens), 0) as total FROM token_usage WHERE DATE(created_at) = CURDATE()'
        );

        $tierDistribution = $this->db->query(
            'SELECT user_tier as user_tier, COUNT(*) as count FROM kbit_users GROUP BY user_tier'
        );

        $featureUsage = $this->db->query(
            'SELECT request_type as feature, COUNT(*) as count FROM token_usage WHERE DATE(created_at) = CURDATE() GROUP BY request_type ORDER BY count DESC LIMIT 5'
        );

        return [
            'success' => true,
            'data' => [
                'stats' => [
                    'total_users' => $userCount['count'] ?? 0,
                    'active_users' => $activeUsers['count'] ?? 0,
                    'today_requests' => $todayRequests['count'] ?? 0,
                    'today_cost' => (float) ($todayCost['total'] ?? 0),
                    'month_revenue' => (float) ($monthRevenue['total'] ?? 0)
                ],
                'tier_distribution' => $tierDistribution,
                'feature_usage' => $featureUsage
            ]
        ];
    }

    public function getUsers(array $request): array
    {
        if (!$this->checkAdmin()) {
            return ['success' => false, 'error' => '无权限', 'code' => 403];
        }

        $page = (int) ($request['query']['page'] ?? 1);
        $limit = (int) ($request['query']['limit'] ?? 20);
        $search = trim($request['query']['search'] ?? '');
        $tier = trim($request['query']['tier'] ?? '');
        $status = trim($request['query']['status'] ?? '');
        $offset = ($page - 1) * $limit;

        $where = '1=1';
        $params = [];

        if (!empty($search)) {
            $where .= ' AND (email LIKE ? OR nickname LIKE ?)';
            $searchParam = "%{$search}%";
            $params = array_merge($params, [$searchParam, $searchParam]);
        }

        if (!empty($tier)) {
            $where .= ' AND user_tier = ?';
            $params[] = $tier;
        }

        if (!empty($status)) {
            $where .= ' AND status = ?';
            $params[] = $status;
        }

        $users = $this->db->query(
            "SELECT id as id, email, nickname, user_tier as user_tier, 
                    daily_points, purchased_points, total_consumed_points, 
                    status, tier_expires_at, created_at as last_login_at, created_at as created_at 
             FROM kbit_users WHERE {$where} ORDER BY created_at DESC LIMIT ? OFFSET ?",
            array_merge($params, [$limit, $offset])
        );

        $total = $this->db->queryOne(
            "SELECT COUNT(*) as count FROM kbit_users WHERE {$where}",
            $params
        );

        return [
            'success' => true,
            'data' => [
                'users' => $users,
                'pagination' => [
                    'page' => $page,
                    'limit' => $limit,
                    'total' => $total['count'] ?? 0,
                    'total_pages' => ceil(($total['count'] ?? 0) / $limit)
                ]
            ]
        ];
    }

    public function getUserDetail(array $request): array
    {
        if (!$this->checkAdmin()) {
            return ['success' => false, 'error' => '无权限', 'code' => 403];
        }

        $userId = (int) ($request['params']['id'] ?? 0);

        $user = $this->db->queryOne(
            "SELECT id as id, email, nickname, user_tier as user_tier, 
                    daily_points, purchased_points, total_consumed_points, 
                    status, tier_expires_at, created_at, updated_at 
             FROM kbit_users WHERE id = ?",
            [$userId]
        );
        
        if (!$user) {
            return ['success' => false, 'error' => '用户不存在', 'code' => 404];
        }

        // 获取今日使用统计
        $todayStats = $this->db->queryOne(
            "SELECT COUNT(*) as total_requests, SUM(total_tokens) as total_points_spent 
             FROM token_usage 
             WHERE user_id = ? AND DATE(created_at) = CURDATE()",
            [$userId]
        );

        // 获取本周使用统计
        $weekStats = $this->db->queryOne(
            "SELECT COUNT(*) as total_requests, SUM(total_tokens) as total_points_spent 
             FROM token_usage 
             WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)",
            [$userId]
        );

        // 获取最近7天的每日使用统计
        $dailyStats = $this->db->query(
            "SELECT DATE(created_at) as date, COUNT(*) as total_requests, SUM(total_tokens) as total_points_spent 
             FROM token_usage 
             WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) 
             GROUP BY DATE(created_at) 
             ORDER BY date",
            [$userId]
        );

        $usageStats = [
            'today' => [
                'total_requests' => $todayStats['total_requests'] ?? 0,
                'total_points_spent' => $todayStats['total_points_spent'] ?? 0
            ],
            'week' => [
                'total_requests' => $weekStats['total_requests'] ?? 0,
                'total_points_spent' => $weekStats['total_points_spent'] ?? 0
            ],
            'daily' => $dailyStats
        ];

        return [
            'success' => true,
            'data' => [
                'user' => $user,
                'usage_stats' => $usageStats
            ]
        ];
    }

    public function updateUser(array $request): array
    {
        if (!$this->checkAdmin()) {
            return ['success' => false, 'error' => '无权限', 'code' => 403];
        }

        $userId = (int) ($request['params']['id'] ?? 0);

        $user = $this->db->queryOne(
            'SELECT id FROM kbit_users WHERE id = ?',
            [$userId]
        );
        
        if (!$user) {
            return ['success' => false, 'error' => '用户不存在', 'code' => 404];
        }

        $data = $request['body'] ?? [];
        $updateData = [];

        // 允许更新的字段
        $allowedFields = [
            'tier', 'user_tier', 'daily_points', 'purchased_points', 'status', 'tier_expires_at'
        ];

        foreach ($allowedFields as $field) {
            if (isset($data[$field])) {
                if ($field === 'user_tier') {
                    $updateData['user_tier'] = $data[$field];
                } else {
                    $updateData[$field] = $data[$field];
                }
            }
        }

        if (empty($updateData)) {
            return ['success' => false, 'error' => '没有要更新的数据', 'code' => 400];
        }

        $this->db->update('kbit_users', $updateData, ['id' => $userId]);

        $updatedUser = $this->db->queryOne(
            "SELECT id as id, email, nickname, user_tier as user_tier, 
                    daily_points, purchased_points, total_consumed_points, 
                    status, tier_expires_at, created_at, updated_at 
             FROM kbit_users WHERE id = ?",
            [$userId]
        );

        return [
            'success' => true,
            'message' => '用户信息更新成功',
            'data' => $updatedUser
        ];
    }

    public function deleteUser(array $request): array
    {
        if (!$this->checkAdmin()) {
            return ['success' => false, 'error' => '无权限', 'code' => 403];
        }

        $userId = (int) ($request['params']['id'] ?? 0);

        $user = $this->db->queryOne(
            'SELECT id FROM kbit_users WHERE id = ?',
            [$userId]
        );
        
        if (!$user) {
            return ['success' => false, 'error' => '用户不存在', 'code' => 404];
        }

        // 开始事务
        $this->db->beginTransaction();

        try {
            // 删除用户相关数据
            $this->db->query('DELETE FROM token_usage WHERE user_id = ?', [$userId]);
            $this->db->query('DELETE FROM subscriptions WHERE user_id = ?', [$userId]);
            
            // 删除用户
            $this->db->query('DELETE FROM kbit_users WHERE id = ?', [$userId]);

            $this->db->commit();

            return [
                'success' => true,
                'message' => '用户删除成功'
            ];
        } catch (Exception $e) {
            $this->db->rollBack();
            return ['success' => false, 'error' => '删除失败: ' . $e->getMessage(), 'code' => 500];
        }
    }

    public function getModels(array $request): array
    {
        if (!$this->checkAdmin()) {
            return ['success' => false, 'error' => '无权限', 'code' => 403];
        }

        $models = $this->db->query('SELECT * FROM models ORDER BY model_type, sort_order');

        return [
            'success' => true,
            'data' => ['models' => $models]
        ];
    }

    public function updateModel(array $request): array
    {
        if (!$this->checkAdmin()) {
            return ['success' => false, 'error' => '无权限', 'code' => 403];
        }

        $modelId = (int) ($request['params']['id'] ?? 0);
        $data = $request['body'];

        $allowedFields = [
            'model_name', 'description', 'input_price', 'output_price',
            'image_price', 'video_price', 'max_tokens', 'supports_vision',
            'supports_streaming', 'stability_score', 'avg_latency_ms',
            'min_tier', 'is_active', 'sort_order'
        ];

        $updateData = [];
        foreach ($allowedFields as $field) {
            if (isset($data[$field])) {
                $updateData[$field] = $data[$field];
            }
        }

        if (empty($updateData)) {
            return ['success' => false, 'error' => '没有要更新的数据', 'code' => 400];
        }

        $this->db->update('models', $updateData, ['id' => $modelId]);

        return [
            'success' => true,
            'message' => '模型配置已更新'
        ];
    }

    public function addModel(array $request): array
    {
        if (!$this->checkAdmin()) {
            return ['success' => false, 'error' => '无权限', 'code' => 403];
        }

        $data = $request['body'];

        $required = ['model_id', 'model_name', 'model_type', 'provider'];
        foreach ($required as $field) {
            if (empty($data[$field])) {
                return ['success' => false, 'error' => "缺少必填字段: {$field}", 'code' => 400];
            }
        }

        $id = $this->db->insert('models', [
            'model_id' => $data['model_id'],
            'model_name' => $data['model_name'],
            'model_type' => $data['model_type'],
            'provider' => $data['provider'],
            'description' => $data['description'] ?? '',
            'input_price' => $data['input_price'] ?? 0,
            'output_price' => $data['output_price'] ?? 0,
            'image_price' => $data['image_price'] ?? 0,
            'video_price' => $data['video_price'] ?? 0,
            'max_tokens' => $data['max_tokens'] ?? 8192,
            'supports_vision' => $data['supports_vision'] ?? 0,
            'supports_streaming' => $data['supports_streaming'] ?? 1,
            'stability_score' => $data['stability_score'] ?? 0.90,
            'avg_latency_ms' => $data['avg_latency_ms'] ?? 1000,
            'min_tier' => $data['min_tier'] ?? 'free',
            'is_active' => 1,
            'sort_order' => $data['sort_order'] ?? 0
        ]);

        return [
            'success' => true,
            'message' => '模型添加成功',
            'data' => ['id' => $id]
        ];
    }

    public function getChannels(array $request): array
    {
        if (!$this->checkAdmin()) {
            return ['success' => false, 'error' => '无权限', 'code' => 403];
        }

        $channels = $this->db->query('SELECT * FROM channels ORDER BY priority DESC');

        return [
            'success' => true,
            'data' => ['channels' => $channels]
        ];
    }

    public function updateChannel(array $request): array
    {
        if (!$this->checkAdmin()) {
            return ['success' => false, 'error' => '无权限', 'code' => 403];
        }

        $channelId = (int) ($request['params']['id'] ?? 0);
        $data = $request['body'];

        $allowedFields = [
            'channel_name', 'base_url', 'models_supported', 'priority',
            'weight', 'status', 'rate_limit_rpm', 'rate_limit_tpm'
        ];

        $updateData = [];
        foreach ($allowedFields as $field) {
            if (isset($data[$field])) {
                $updateData[$field] = is_array($data[$field]) ? json_encode($data[$field]) : $data[$field];
            }
        }

        if (empty($updateData)) {
            return ['success' => false, 'error' => '没有要更新的数据', 'code' => 400];
        }

        $this->db->update('channels', $updateData, ['id' => $channelId]);

        return [
            'success' => true,
            'message' => '渠道配置已更新'
        ];
    }

    public function getConfigs(array $request): array
    {
        if (!$this->checkAdmin()) {
            return ['success' => false, 'error' => '无权限', 'code' => 403];
        }

        $category = $request['query']['category'] ?? null;
        
        $where = $category ? 'WHERE config_type = ?' : '';
        $params = $category ? [$category] : [];

        $configs = $this->db->query(
            "SELECT * FROM system_config {$where} ORDER BY config_type, config_key",
            $params
        );

        $grouped = [];
        foreach ($configs as $config) {
            $cat = $config['config_type'];
            if (!isset($grouped[$cat])) {
                $grouped[$cat] = [];
            }
            $grouped[$cat][] = $config;
        }

        return [
            'success' => true,
            'data' => ['configs' => $grouped]
        ];
    }

    public function updateConfig(array $request): array
    {
        if (!$this->checkAdmin()) {
            return ['success' => false, 'error' => '无权限', 'code' => 403];
        }

        $configKey = $request['params']['key'] ?? '';
        $value = $request['body']['value'] ?? null;

        if (empty($configKey) || $value === null) {
            return ['success' => false, 'error' => '参数无效', 'code' => 400];
        }

        $config = $this->db->queryOne(
            'SELECT * FROM system_config WHERE config_key = ?',
            [$configKey]
        );

        if (!$config) {
            return ['success' => false, 'error' => '配置项不存在', 'code' => 404];
        }

        $this->db->update('system_config', [
            'config_value' => is_array($value) ? json_encode($value) : (string) $value
        ], ['config_key' => $configKey]);

        return [
            'success' => true,
            'message' => '配置已更新'
        ];
    }

    public function getUsageLogs(array $request): array
    {
        if (!$this->checkAdmin()) {
            return ['success' => false, 'error' => '无权限', 'code' => 403];
        }

        $page = (int) ($request['query']['page'] ?? 1);
        $limit = (int) ($request['query']['limit'] ?? 50);
        $userId = $request['query']['user_id'] ?? null;
        $feature = $request['query']['feature'] ?? null;
        $status = $request['query']['status'] ?? null;
        $date = $request['query']['date'] ?? null;
        $offset = ($page - 1) * $limit;

        $where = '1=1';
        $params = [];

        if ($userId) {
            $where .= ' AND user_id = ?';
            $params[] = $userId;
        }
        if ($feature) {
            $where .= ' AND request_type = ?';
            $params[] = $feature;
        }

        if ($date) {
            $where .= ' AND DATE(created_at) = ?';
            $params[] = $date;
        }

        $logs = $this->db->query(
            "SELECT l.*, u.email, u.nickname
             FROM token_usage l
             LEFT JOIN kbit_users u ON l.user_id = u.email
             WHERE {$where}
             ORDER BY l.created_at DESC
             LIMIT ? OFFSET ?",
            array_merge($params, [$limit, $offset])
        );

        $total = $this->db->queryOne(
            "SELECT COUNT(*) as count FROM token_usage WHERE {$where}",
            $params
        );

        return [
            'success' => true,
            'data' => [
                'logs' => $logs,
                'pagination' => [
                    'page' => $page,
                    'limit' => $limit,
                    'total' => $total['count'] ?? 0,
                    'total_pages' => ceil(($total['count'] ?? 0) / $limit)
                ]
            ]
        ];
    }

    public function getCostReport(array $request): array
    {
        if (!$this->checkAdmin()) {
            return ['success' => false, 'error' => '无权限', 'code' => 403];
        }

        $period = $request['query']['period'] ?? 'today';
        $report = $this->costController->getCostReport($period);

        return [
            'success' => true,
            'data' => $report
        ];
    }

    public function getRoutingRules(array $request): array
    {
        if (!$this->checkAdmin()) {
            return ['success' => false, 'error' => '无权限', 'code' => 403];
        }

        $rules = $this->db->query('SELECT * FROM routing_rules ORDER BY priority DESC');

        return [
            'success' => true,
            'data' => ['rules' => $rules]
        ];
    }

    public function updateRoutingRule(array $request): array
    {
        if (!$this->checkAdmin()) {
            return ['success' => false, 'error' => '无权限', 'code' => 403];
        }

        $ruleId = (int) ($request['params']['id'] ?? 0);
        $data = $request['body'];

        $allowedFields = [
            'rule_name', 'rule_type', 'model_type', 'user_tier',
            'preferred_models', 'fallback_models', 'preferred_channels',
            'fallback_channels', 'max_cost_per_request', 'priority', 'is_active'
        ];

        $updateData = [];
        foreach ($allowedFields as $field) {
            if (isset($data[$field])) {
                $updateData[$field] = is_array($data[$field]) ? json_encode($data[$field]) : $data[$field];
            }
        }

        if (empty($updateData)) {
            return ['success' => false, 'error' => '没有要更新的数据', 'code' => 400];
        }

        $this->db->update('routing_rules', $updateData, ['id' => $ruleId]);

        return [
            'success' => true,
            'message' => '路由规则已更新'
        ];
    }

    public function getBetaRequests(array $request): array
    {
        if (!$this->checkAdmin()) {
            return ['success' => false, 'error' => '无权限', 'code' => 403];
        }

        $page = (int) ($request['query']['page'] ?? 1);
        $limit = (int) ($request['query']['limit'] ?? 20);
        $offset = ($page - 1) * $limit;

        $requests = $this->db->query(
            'SELECT * FROM beta_applications ORDER BY applied_at DESC LIMIT ? OFFSET ?',
            [$limit, $offset]
        );

        $total = $this->db->queryOne('SELECT COUNT(*) as count FROM beta_applications');

        return [
            'success' => true,
            'data' => [
                'requests' => $requests,
                'pagination' => [
                    'page' => $page,
                    'limit' => $limit,
                    'total' => $total['count'] ?? 0,
                    'total_pages' => ceil(($total['count'] ?? 0) / $limit)
                ]
            ]
        ];
    }

    public function approveBetaRequest(array $request): array
    {
        if (!$this->checkAdmin()) {
            return ['success' => false, 'error' => '无权限', 'code' => 403];
        }

        $id = (int) ($request['params']['id'] ?? 0);

        $requestData = $this->db->queryOne(
            'SELECT * FROM beta_applications WHERE id = ?',
            [$id]
        );

        if (!$requestData) {
            return ['success' => false, 'error' => '申请不存在', 'code' => 404];
        }

        if ($requestData['status'] !== 'pending') {
            return ['success' => false, 'error' => '申请已经处理过了', 'code' => 400];
        }

        // 开始事务
            $this->db->beginTransaction();

            try {
                // 更新申请状态
                $this->db->update('beta_applications', [
                    'status' => 'approved',
                    'approved_at' => date('Y-m-d H:i:s')
                ], ['id' => $id]);

                // 检查用户是否已存在
                $existingUser = $this->db->queryOne(
                    'SELECT id FROM kbit_users WHERE email = ?',
                    [$requestData['email']]
                );

                if (!$existingUser) {
                    // 创建新用户
                    $this->db->insert('kbit_users', [
                        'email' => $requestData['email'],
                        'password' => password_hash('beta123', PASSWORD_DEFAULT),
                        'nickname' => '用户_' . substr(md5(time()), 0, 6),
                        'user_tier' => 'basic',
                        'daily_points' => 1000,
                        'status' => 1,
                        'created_at' => date('Y-m-d H:i:s'),
                        'updated_at' => date('Y-m-d H:i:s')
                    ]);
                    // 获取刚插入的用户ID
                    $userId = $this->db->queryOne('SELECT id FROM kbit_users WHERE email = ?', [$requestData['email']])['id'];
                } else {
                    // 更新现有用户
                    $userId = $existingUser['id'];
                    $this->db->update('kbit_users', [
                        'user_tier' => 'basic',
                        'daily_points' => 1000,
                        'status' => 1,
                        'updated_at' => date('Y-m-d H:i:s')
                    ], ['id' => $userId]);
                }

                // 生成邀请码
                $inviteCode = $this->generateInviteCode();
                $expiresAt = date('Y-m-d H:i:s', strtotime('+30 days'));
                
                // 保存邀请码到数据库
                $this->db->insert('invite_codes', [
                    'code' => $inviteCode,
                    'created_by' => 'admin',
                    'points_bonus' => 1000,
                    'max_uses' => 1,
                    'current_uses' => 0,
                    'status' => 'active',
                    'expires_at' => $expiresAt,
                    'created_at' => date('Y-m-d H:i:s')
                ]);

                $this->db->commit();

                // 发送邮件通知
                $emailSent = false;
                $emailError = '';
                try {
                    $mailer = new Mailer();
                    $emailSent = $mailer->sendBetaApproval($requestData['email'], 'beta123', $inviteCode);
                    if (!$emailSent) {
                        $emailError = '邮件发送失败，请检查SMTP配置';
                    }
                } catch (\Exception $e) {
                    $emailError = '邮件发送异常: ' . $e->getMessage();
                    error_log($emailError);
                }

                $message = $emailSent
                    ? '内测申请已批准，邮件已发送'
                    : '内测申请已批准，但邮件发送失败（' . $emailError . '）';

                return [
                    'success' => true,
                    'message' => $message,
                    'data' => [
                        'email_sent' => $emailSent,
                        'invite_code' => $inviteCode
                    ]
                ];
            } catch (\Exception $e) {
                $this->db->rollBack();
                return ['success' => false, 'error' => '批准失败: ' . $e->getMessage(), 'code' => 500];
            }
    }

    public function rejectBetaRequest(array $request): array
    {
        if (!$this->checkAdmin()) {
            return ['success' => false, 'error' => '无权限', 'code' => 403];
        }

        $id = (int) ($request['params']['id'] ?? 0);

        $requestData = $this->db->queryOne(
            'SELECT * FROM beta_applications WHERE id = ?',
            [$id]
        );

        if (!$requestData) {
            return ['success' => false, 'error' => '申请不存在', 'code' => 404];
        }

        if ($requestData['status'] !== 'pending') {
            return ['success' => false, 'error' => '申请已经处理过了', 'code' => 400];
        }

        $this->db->update('beta_applications', [
            'status' => 'rejected',
            'approved_at' => date('Y-m-d H:i:s')
        ], ['id' => $id]);

        return [
            'success' => true,
            'message' => '内测申请已拒绝'
        ];
    }

    /**
     * 生成邀请码
     */
    private function generateInviteCode(): string
    {
        $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        $code = 'KB';
        for ($i = 0; $i < 8; $i++) {
            $code .= $chars[rand(0, strlen($chars) - 1)];
        }
        return $code;
    }
}