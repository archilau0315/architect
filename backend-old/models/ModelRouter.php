<?php
/**
 * 首席图像架构师 - 模型路由器
 * 
 * 实现三种智能路由策略：
 * - 价格优先模式：自动选择成本最低的模型与渠道
 * - 稳定性优先模式：优先选择服务稳定性高的模型与渠道
 * - 用户等级分配模式：根据用户订阅等级分配相应模型资源
 * 
 * @package KbitArchitect
 * @version 1.0.0
 */

namespace KbitArchitect\Models;

use KbitArchitect\Core\Database;
use RuntimeException;

class ModelRouter
{
    private Database $db;
    private array $config;

    public function __construct()
    {
        $this->db = Database::getInstance();
        $this->loadConfig();
    }

    private function loadConfig(): void
    {
        $configs = $this->db->query('SELECT config_key, config_value, config_type FROM system_config');
        $this->config = [];
        foreach ($configs as $config) {
            $value = $config['config_value'];
            if ($config['config_type'] === 'json') {
                $value = json_decode($value, true);
            } elseif ($config['config_type'] === 'number') {
                $value = (float) $value;
            } elseif ($config['config_type'] === 'boolean') {
                $value = filter_var($value, FILTER_VALIDATE_BOOLEAN);
            }
            $this->config[$config['config_key']] = $value;
        }
    }

    public function select(string $feature, string $userTier, string $strategy = null): array
    {
        $strategy = $strategy ?? $this->config['routing.default_strategy'] ?? 'stability';
        
        $modelType = $this->featureToModelType($feature);
        
        $rule = $this->findMatchingRule($modelType, $userTier);
        
        if ($rule) {
            return $this->applyRule($rule, $strategy);
        }
        
        return match ($strategy) {
            'price' => $this->selectByPrice($modelType, $userTier),
            'stability' => $this->selectByStability($modelType, $userTier),
            'tier' => $this->selectByTier($modelType, $userTier),
            default => $this->selectByStability($modelType, $userTier)
        };
    }

    public function selectByPrice(string $modelType, string $userTier): array
    {
        $models = $this->getAvailableModels($modelType, $userTier);
        
        if (empty($models)) {
            throw new RuntimeException('No available models for your subscription tier');
        }
        
        usort($models, function ($a, $b) use ($modelType) {
            $priceA = $this->calculateModelPrice($a, $modelType);
            $priceB = $this->calculateModelPrice($b, $modelType);
            return $priceA <=> $priceB;
        });
        
        $selectedModel = $models[0];
        $channel = $this->selectChannelForModel($selectedModel['model_id'], 'price');
        
        return [
            'model' => $selectedModel,
            'channel' => $channel,
            'strategy' => 'price',
            'estimated_cost' => $this->calculateModelPrice($selectedModel, $modelType)
        ];
    }

    public function selectByStability(string $modelType, string $userTier): array
    {
        $models = $this->getAvailableModels($modelType, $userTier);
        
        if (empty($models)) {
            throw new RuntimeException('No available models for your subscription tier');
        }
        
        usort($models, function ($a, $b) {
            $scoreA = $a['stability_score'] * (1 - $a['avg_latency_ms'] / 10000);
            $scoreB = $b['stability_score'] * (1 - $b['avg_latency_ms'] / 10000);
            return $scoreB <=> $scoreA;
        });
        
        $selectedModel = $models[0];
        $channel = $this->selectChannelForModel($selectedModel['model_id'], 'stability');
        
        return [
            'model' => $selectedModel,
            'channel' => $channel,
            'strategy' => 'stability',
            'estimated_cost' => $this->calculateModelPrice($selectedModel, $modelType)
        ];
    }

    public function selectByTier(string $modelType, string $userTier): array
    {
        $tierPriority = [
            'plus' => ['gemini-3-pro-preview', 'gemini-3-pro-image-preview', 'veo-3.1-generate-preview'],
            'pro' => ['gemini-3-pro-preview', 'gemini-3-flash-preview', 'gemini-3-pro-image-preview'],
            'basic' => ['gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-3.1-flash-image-preview'],
            'free' => ['gemini-2.5-flash', 'deepseek-v3.2', 'gemini-2.5-flash-image']
        ];
        
        $preferredModels = $tierPriority[$userTier] ?? $tierPriority['free'];
        
        foreach ($preferredModels as $modelId) {
            $model = $this->getModelById($modelId, $modelType);
            if ($model && $this->isModelAvailableForTier($model, $userTier)) {
                $channel = $this->selectChannelForModel($modelId, 'stability');
                if ($channel) {
                    return [
                        'model' => $model,
                        'channel' => $channel,
                        'strategy' => 'tier',
                        'estimated_cost' => $this->calculateModelPrice($model, $modelType)
                    ];
                }
            }
        }
        
        return $this->selectByStability($modelType, $userTier);
    }

    private function featureToModelType(string $feature): string
    {
        return match ($feature) {
            'image_gen', 'image_inpaint', 'image_transform' => 'image',
            'video_gen', 'video_animation' => 'video',
            'chat', 'prompt_enhance' => 'text',
            'image_analyze' => 'multimodal',
            default => 'multimodal'
        };
    }

    private function getAvailableModels(string $modelType, string $userTier): array
    {
        $tierOrder = ['free' => 0, 'basic' => 1, 'pro' => 2, 'plus' => 3];
        $userTierLevel = $tierOrder[$userTier] ?? 0;
        
        $sql = 'SELECT * FROM models WHERE is_active = 1 
                AND (model_type = ? OR model_type = "multimodal")
                ORDER BY sort_order ASC';
        
        $models = $this->db->query($sql, [$modelType]);
        
        return array_filter($models, function ($model) use ($userTierLevel, $tierOrder) {
            $modelTierLevel = $tierOrder[$model['min_tier']] ?? 0;
            return $userTierLevel >= $modelTierLevel;
        });
    }

    private function getModelById(string $modelId, string $modelType): ?array
    {
        return $this->db->queryOne(
            'SELECT * FROM models WHERE model_id = ? AND is_active = 1 AND (model_type = ? OR model_type = "multimodal")',
            [$modelId, $modelType]
        );
    }

    private function isModelAvailableForTier(array $model, string $userTier): bool
    {
        $tierOrder = ['free' => 0, 'basic' => 1, 'pro' => 2, 'plus' => 3];
        $userTierLevel = $tierOrder[$userTier] ?? 0;
        $modelTierLevel = $tierOrder[$model['min_tier']] ?? 0;
        
        return $userTierLevel >= $modelTierLevel;
    }

    private function selectChannelForModel(string $modelId, string $strategy): ?array
    {
        $channels = $this->db->query(
            'SELECT * FROM channels WHERE status = "active" AND JSON_CONTAINS(models_supported, ?) ORDER BY priority DESC, weight DESC',
            [json_encode($modelId)]
        );
        
        if (empty($channels)) {
            return null;
        }
        
        if ($strategy === 'price') {
            usort($channels, fn($a, $b) => $a['avg_latency_ms'] <=> $b['avg_latency_ms']);
        } else {
            usort($channels, fn($a, $b) => $b['success_rate'] <=> $a['success_rate']);
        }
        
        return $channels[0];
    }

    private function calculateModelPrice(array $model, string $modelType): float
    {
        return match ($modelType) {
            'image' => $model['image_price'],
            'video' => $model['video_price'],
            default => ($model['input_price'] + $model['output_price']) * 10
        };
    }

    private function findMatchingRule(string $modelType, string $userTier): ?array
    {
        return $this->db->queryOne(
            'SELECT * FROM routing_rules WHERE is_active = 1 
             AND (model_type = ? OR model_type = "all")
             AND (user_tier = ? OR user_tier = "all")
             ORDER BY priority DESC LIMIT 1',
            [$modelType, $userTier]
        );
    }

    private function applyRule(array $rule, string $fallbackStrategy): array
    {
        $preferredModels = json_decode($rule['preferred_models'] ?? '[]', true);
        $preferredChannels = json_decode($rule['preferred_channels'] ?? '[]', true);
        
        foreach ($preferredModels as $modelId) {
            $model = $this->db->queryOne(
                'SELECT * FROM models WHERE model_id = ? AND is_active = 1',
                [$modelId]
            );
            
            if ($model) {
                foreach ($preferredChannels as $channelId) {
                    $channel = $this->db->queryOne(
                        'SELECT * FROM channels WHERE channel_id = ? AND status = "active"',
                        [$channelId]
                    );
                    
                    if ($channel && $this->channelSupportsModel($channel, $modelId)) {
                        return [
                            'model' => $model,
                            'channel' => $channel,
                            'strategy' => 'rule',
                            'rule_name' => $rule['rule_name'],
                            'estimated_cost' => $this->calculateModelPrice($model, $model['model_type'])
                        ];
                    }
                }
            }
        }
        
        return $this->selectByStability($rule['model_type'] ?? 'multimodal', $rule['user_tier'] ?? 'free');
    }

    private function channelSupportsModel(array $channel, string $modelId): bool
    {
        $supportedModels = json_decode($channel['models_supported'] ?? '[]', true);
        return in_array($modelId, $supportedModels);
    }

    public function getAvailableModelsForUser(string $userTier): array
    {
        $tierOrder = ['free' => 0, 'basic' => 1, 'pro' => 2, 'plus' => 3];
        $userTierLevel = $tierOrder[$userTier] ?? 0;
        
        $models = $this->db->query('SELECT * FROM models WHERE is_active = 1 ORDER BY model_type, sort_order');
        
        return array_filter($models, function ($model) use ($userTierLevel, $tierOrder) {
            $modelTierLevel = $tierOrder[$model['min_tier']] ?? 0;
            return $userTierLevel >= $modelTierLevel;
        });
    }

    public function getChannelStatus(): array
    {
        return $this->db->query(
            'SELECT channel_id, channel_name, provider, status, success_rate, avg_latency_ms, 
                    total_requests, failed_requests, last_error_at 
             FROM channels ORDER BY priority DESC'
        );
    }

    public function recordChannelResult(string $channelId, bool $success, int $latencyMs, ?string $errorMsg = null): void
    {
        $channel = $this->db->queryOne('SELECT * FROM channels WHERE channel_id = ?', [$channelId]);
        
        if (!$channel) {
            return;
        }
        
        $totalRequests = $channel['total_requests'] + 1;
        $failedRequests = $channel['failed_requests'] + ($success ? 0 : 1);
        $successRate = (($totalRequests - $failedRequests) / $totalRequests) * 100;
        
        $updateData = [
            'total_requests' => $totalRequests,
            'failed_requests' => $failedRequests,
            'success_rate' => $successRate,
            'avg_latency_ms' => (int) (($channel['avg_latency_ms'] * ($totalRequests - 1) + $latencyMs) / $totalRequests)
        ];
        
        if (!$success) {
            $updateData['last_error_at'] = date('Y-m-d H:i:s');
            $updateData['last_error_msg'] = $errorMsg;
        }
        
        $this->db->update('channels', $updateData, ['channel_id' => $channelId]);
    }
}
