<?php
/**
 * 首席图像架构师 - 路由控制器
 * 
 * @package KbitArchitect
 * @version 1.0.0
 */

namespace KbitArchitect\Controllers;

use KbitArchitect\Core\Database;
use KbitArchitect\Models\ModelRouter;
use KbitArchitect\Models\QuotaManager;
use KbitArchitect\Models\CostController;

class RoutingController
{
    private ModelRouter $modelRouter;
    private QuotaManager $quotaManager;
    private CostController $costController;
    private Database $db;

    public function __construct()
    {
        $this->modelRouter = new ModelRouter();
        $this->quotaManager = new QuotaManager();
        $this->costController = new CostController();
        $this->db = Database::getInstance();
    }

    public function selectModel(array $request): array
    {
        $userId = $GLOBALS['auth_user']['id'] ?? null;
        $userTier = $GLOBALS['auth_user']['tier'] ?? 'free';
        
        if (!$userId) {
            return ['success' => false, 'error' => '未授权', 'code' => 401];
        }

        $feature = $request['body']['feature'] ?? 'image_gen';
        $strategy = $request['body']['strategy'] ?? null;
        $params = $request['body']['params'] ?? [];

        $estimatedCost = $this->quotaManager->calculateCost($feature, $params);

        $quotaCheck = $this->quotaManager->checkQuota($userId, $feature, $estimatedCost);
        if (!$quotaCheck['allowed']) {
            return [
                'success' => false,
                'error' => $quotaCheck['reason'],
                'code' => 402,
                'data' => ['quota' => $quotaCheck['quota'] ?? null]
            ];
        }

        $resolution = $params['resolution'] ?? '1K';
        $resolutionCheck = $this->quotaManager->checkResolution($userId, $resolution);
        if (!$resolutionCheck['allowed']) {
            return [
                'success' => false,
                'error' => $resolutionCheck['reason'],
                'code' => 403
            ];
        }

        if ($this->costController->shouldTriggerCircuitBreaker()) {
            $fallbackModel = $this->costController->getFallbackModel();
            return [
                'success' => true,
                'data' => [
                    'model' => [
                        'model_id' => $fallbackModel,
                        'model_name' => 'Budget Fallback Model'
                    ],
                    'channel' => null,
                    'strategy' => 'circuit_breaker',
                    'estimated_cost' => 0,
                    'quota' => $quotaCheck['quota'],
                    'warning' => '系统预算已达上限，已自动降级'
                ]
            ];
        }

        try {
            $selection = $this->modelRouter->select($feature, $userTier, $strategy);
            
            return [
                'success' => true,
                'data' => [
                    'model' => [
                        'model_id' => $selection['model']['model_id'],
                        'model_name' => $selection['model']['model_name'],
                        'model_type' => $selection['model']['model_type'],
                        'supports_vision' => (bool) $selection['model']['supports_vision']
                    ],
                    'channel' => $selection['channel'] ? [
                        'channel_id' => $selection['channel']['channel_id'],
                        'channel_name' => $selection['channel']['channel_name'],
                        'base_url' => $selection['channel']['base_url']
                    ] : null,
                    'strategy' => $selection['strategy'],
                    'estimated_cost' => $selection['estimated_cost'],
                    'quota' => $quotaCheck['quota']
                ]
            ];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage(), 'code' => 500];
        }
    }

    public function getAvailableModels(array $request): array
    {
        $userTier = $GLOBALS['auth_user']['tier'] ?? 'free';

        $models = $this->modelRouter->getAvailableModelsForUser($userTier);

        $models = array_map(function ($model) {
            return [
                'model_id' => $model['model_id'],
                'model_name' => $model['model_name'],
                'model_type' => $model['model_type'],
                'provider' => $model['provider'],
                'description' => $model['description'],
                'min_tier' => $model['min_tier'],
                'supports_vision' => (bool) $model['supports_vision']
            ];
        }, $models);

        return [
            'success' => true,
            'data' => [
                'models' => array_values($models),
                'user_tier' => $userTier
            ]
        ];
    }

    public function getChannels(array $request): array
    {
        $channels = $this->modelRouter->getChannelStatus();

        $channels = array_map(function ($channel) {
            return [
                'channel_id' => $channel['channel_id'],
                'channel_name' => $channel['channel_name'],
                'provider' => $channel['provider'],
                'status' => $channel['status'],
                'success_rate' => (float) $channel['success_rate'],
                'avg_latency_ms' => (int) $channel['avg_latency_ms']
            ];
        }, $channels);

        return [
            'success' => true,
            'data' => [
                'channels' => $channels
            ]
        ];
    }

    public function checkQuota(array $request): array
    {
        $userId = $GLOBALS['auth_user']['id'] ?? null;
        
        if (!$userId) {
            return ['success' => false, 'error' => '未授权', 'code' => 401];
        }

        $feature = $request['body']['feature'] ?? 'image_gen';
        $params = $request['body']['params'] ?? [];

        $estimatedCost = $this->quotaManager->calculateCost($feature, $params);
        $check = $this->quotaManager->checkQuota($userId, $feature, $estimatedCost);

        return [
            'success' => true,
            'data' => [
                'allowed' => $check['allowed'],
                'reason' => $check['reason'] ?? null,
                'quota' => $check['quota'] ?? null,
                'estimated_cost' => $estimatedCost
            ]
        ];
    }

    public function preDeduct(array $request): array
    {
        $userId = $GLOBALS['auth_user']['id'] ?? null;
        
        if (!$userId) {
            return ['success' => false, 'error' => '未授权', 'code' => 401];
        }

        $amount = (float) ($request['body']['amount'] ?? 0);
        $feature = $request['body']['feature'] ?? 'unknown';
        $requestId = $request['body']['request_id'] ?? $this->generateRequestId();

        if ($amount <= 0) {
            return ['success' => false, 'error' => '扣除金额无效', 'code' => 400];
        }

        $result = $this->quotaManager->preDeduct($userId, $amount, $feature, $requestId);

        return $result;
    }

    public function refund(array $request): array
    {
        $userId = $GLOBALS['auth_user']['id'] ?? null;
        
        if (!$userId) {
            return ['success' => false, 'error' => '未授权', 'code' => 401];
        }

        $amount = (float) ($request['body']['amount'] ?? 0);
        $requestId = $request['body']['request_id'] ?? '';
        $reason = $request['body']['reason'] ?? 'API调用失败';

        if ($amount <= 0) {
            return ['success' => false, 'error' => '退还金额无效', 'code' => 400];
        }

        $success = $this->quotaManager->refund($userId, $amount, $requestId, $reason);

        return [
            'success' => $success,
            'message' => $success ? '积分已退还' : '退还失败',
            'data' => [
                'amount' => $amount,
                'new_balance' => $this->userModel->getTotalPoints($userId)
            ]
        ];
    }

    public function logUsage(array $request): array
    {
        $userId = $GLOBALS['auth_user']['id'] ?? null;
        
        if (!$userId) {
            return ['success' => false, 'error' => '未授权', 'code' => 401];
        }

        $data = $request['body'];
        $data['user_id'] = $userId;
        $data['ip_address'] = $request['ip'];
        $data['user_agent'] = $request['user_agent'] ?? null;

        $logId = $this->costController->logUsage($data);

        return [
            'success' => true,
            'data' => [
                'log_id' => $logId
            ]
        ];
    }

    public function checkCache(array $request): array
    {
        $feature = $request['body']['feature'] ?? '';
        $params = $request['body']['params'] ?? [];

        $requestHash = $this->costController->generateRequestHash($feature, $params);
        $cached = $this->costController->checkCache($requestHash);

        if ($cached) {
            return [
                'success' => true,
                'data' => [
                    'cache_hit' => true,
                    'result' => $cached['value'],
                    'model_id' => $cached['model_id'],
                    'created_at' => $cached['created_at']
                ]
            ];
        }

        return [
            'success' => true,
            'data' => [
                'cache_hit' => false,
                'request_hash' => $requestHash
            ]
        ];
    }

    public function setCache(array $request): array
    {
        $feature = $request['body']['feature'] ?? '';
        $params = $request['body']['params'] ?? [];
        $value = $request['body']['value'] ?? null;
        $modelId = $request['body']['model_id'] ?? 'unknown';

        if ($value === null) {
            return ['success' => false, 'error' => '缓存值不能为空', 'code' => 400];
        }

        $requestHash = $this->costController->generateRequestHash($feature, $params);
        $success = $this->costController->setCache($requestHash, $modelId, $feature, $value);

        return [
            'success' => $success,
            'message' => $success ? '缓存已保存' : '缓存保存失败'
        ];
    }

    public function getBudgetStatus(array $request): array
    {
        $budget = $this->costController->checkBudget();

        return [
            'success' => true,
            'data' => $budget
        ];
    }

    public function getCostReport(array $request): array
    {
        $period = $request['query']['period'] ?? 'today';
        $report = $this->costController->getCostReport($period);

        return [
            'success' => true,
            'data' => $report
        ];
    }

    private function generateRequestId(): string
    {
        return 'req_' . uniqid() . '_' . bin2hex(random_bytes(4));
    }
}
