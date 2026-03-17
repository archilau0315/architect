<?php
/**
 * 首席图像架构师 - 管理后台控制器
 * 
 * @package KbitArchitect
 * @version 1.0.0
 */

namespace KbitArchitect\Controllers;

use KbitArchitect\Core\Database;
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
            'SELECT * FROM admins WHERE id = ? AND status = 1',
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
            'SELECT * FROM admins WHERE username = ? AND status = 1',
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

        return [
            'success' => true,
            'message' => '登录成功',
            'data' => [
                'admin' => $admin,
                'token' => bin2hex(random_bytes(32))
            ]
        ];
    }

    public function getDashboard(array $request): array
    {
        if (!$this->checkAdmin()) {
            return ['success' => false, 'error' => '无权限', 'code' => 403];
        }

        $userCount = $this->db->queryOne('SELECT COUNT(*) as count FROM users');
        $activeUsers = $this->db->queryOne(
            'SELECT COUNT(*) as count FROM users WHERE last_login_at > DATE_SUB(NOW(), INTERVAL 7 DAY)'
        );
        $todayRequests = $this->db->queryOne(
            'SELECT COUNT(*) as count FROM usage_logs WHERE DATE(created_at) = CURDATE()'
        );
        $todayCost = $this->db->queryOne(
            'SELECT COALESCE(SUM(actual_cost), 0) as total FROM usage_logs WHERE DATE(created_at) = CURDATE()'
        );
        $monthRevenue = $this->db->queryOne(
            'SELECT COALESCE(SUM(amount), 0) as total FROM subscriptions WHERE status = "active" AND created_at >= DATE_FORMAT(NOW(), "%Y-%m-01")'
        );

        $tierDistribution = $this->db->query(
            'SELECT user_tier, COUNT(*) as count FROM users GROUP BY user_tier'
        );

        $featureUsage = $this->db->query(
            'SELECT feature, COUNT(*) as count FROM usage_logs WHERE DATE(created_at) = CURDATE() GROUP BY feature ORDER BY count DESC LIMIT 5'
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
        $offset = ($page - 1) * $limit;

        $where = '1=1';
        $params = [];

        if (!empty($search)) {
            $where .= ' AND (email LIKE ? OR nickname LIKE ? OR phone LIKE ?)';
            $searchParam = "%{$search}%";
            $params = array_merge($params, [$searchParam, $searchParam, $searchParam]);
        }

        if (!empty($tier)) {
            $where .= ' AND user_tier = ?';
            $params[] = $tier;
        }

        $users = $this->db->query(
            "SELECT id, email, phone, nickname, user_tier, tier_expires_at, 
                    daily_points, purchased_points, total_consumed_points, 
                    status, last_login_at, created_at 
             FROM users WHERE {$where} ORDER BY created_at DESC LIMIT ? OFFSET ?",
            array_merge($params, [$limit, $offset])
        );

        $total = $this->db->queryOne(
            "SELECT COUNT(*) as count FROM users WHERE {$where}",
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

        $user = $this->userModel->findById($userId);
        if (!$user) {
            return ['success' => false, 'error' => '用户不存在', 'code' => 404];
        }

        unset($user['password_hash']);

        $subscriptions = $this->db->query(
            'SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 5',
            [$userId]
        );

        $recentUsage = $this->db->query(
            'SELECT * FROM usage_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
            [$userId]
        );

        $transactions = $this->db->query(
            'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
            [$userId]
        );

        return [
            'success' => true,
            'data' => [
                'user' => $user,
                'subscriptions' => $subscriptions,
                'recent_usage' => $recentUsage,
                'transactions' => $transactions
            ]
        ];
    }

    public function updateUser(array $request): array
    {
        if (!$this->checkAdmin()) {
            return ['success' => false, 'error' => '无权限', 'code' => 403];
        }

        $userId = (int) ($request['params']['id'] ?? 0);
        $action = $request['body']['action'] ?? '';

        $user = $this->userModel->findById($userId);
        if (!$user) {
            return ['success' => false, 'error' => '用户不存在', 'code' => 404];
        }

        switch ($action) {
            case 'update_tier':
                $tier = $request['body']['tier'] ?? '';
                $expiresAt = $request['body']['expires_at'] ?? null;
                $this->userModel->updateTier($userId, $tier, $expiresAt);
                break;
                
            case 'add_points':
                $points = (float) ($request['body']['points'] ?? 0);
                $this->userModel->addPurchasedPoints($userId, $points, 'ADMIN-' . date('YmdHis'));
                break;
                
            case 'toggle_status':
                $newStatus = $user['status'] == 1 ? 0 : 1;
                $this->db->update('users', ['status' => $newStatus], ['id' => $userId]);
                break;
                
            default:
                return ['success' => false, 'error' => '无效操作', 'code' => 400];
        }

        return [
            'success' => true,
            'message' => '操作成功',
            'data' => $this->userModel->findById($userId)
        ];
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
        
        $where = $category ? 'WHERE category = ?' : '';
        $params = $category ? [$category] : [];

        $configs = $this->db->query(
            "SELECT * FROM system_config {$where} ORDER BY category, config_key",
            $params
        );

        $grouped = [];
        foreach ($configs as $config) {
            $cat = $config['category'];
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
            'config_value' => is_array($value) ? json_encode($value) : (string) $value,
            'updated_by' => $GLOBALS['auth_user']['id'] ?? null
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
            $where .= ' AND feature = ?';
            $params[] = $feature;
        }
        if ($status) {
            $where .= ' AND status = ?';
            $params[] = $status;
        }
        if ($date) {
            $where .= ' AND DATE(created_at) = ?';
            $params[] = $date;
        }

        $logs = $this->db->query(
            "SELECT l.*, u.email, u.nickname 
             FROM usage_logs l 
             LEFT JOIN users u ON l.user_id = u.id 
             WHERE {$where} 
             ORDER BY l.created_at DESC 
             LIMIT ? OFFSET ?",
            array_merge($params, [$limit, $offset])
        );

        $total = $this->db->queryOne(
            "SELECT COUNT(*) as count FROM usage_logs WHERE {$where}",
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
}
