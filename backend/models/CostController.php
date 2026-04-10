<?php
/**
 * 首席图像架构师 - 成本控制器
 * 
 * 实现防刷、防抖、缓存、预算熔断等成本控制功能
 * 
 * @package KbitArchitect
 * @version 1.0.0
 */

namespace KbitArchitect\Models;

use KbitArchitect\Core\Database;
use RuntimeException;

class CostController
{
    private Database $db;
    private array $config;
    private string $cachePath;

    public function __construct()
    {
        $this->db = Database::getInstance();
        $this->loadConfig();
        $this->cachePath = __DIR__ . '/../storage/cache/response';
    }

    private function loadConfig(): void
    {
        $configs = $this->db->query('SELECT config_key, config_value, config_type FROM system_config');
        $this->config = [];
        foreach ($configs as $config) {
            $value = $config['config_value'];
            if ($config['config_type'] === 'number') {
                $value = (float) $value;
            } elseif ($config['config_type'] === 'boolean') {
                $value = filter_var($value, FILTER_VALIDATE_BOOLEAN);
            }
            $this->config[$config['config_key']] = $value;
        }
    }

    public function checkAntiBot(int $userId, string $ip, string $feature): array
    {
        if (!($this->config['ratelimit.enable_antibot'] ?? true)) {
            return ['allowed' => true];
        }
        
        $suspiciousPatterns = $this->detectSuspiciousPatterns($userId, $ip, $feature);
        
        if (!empty($suspiciousPatterns)) {
            return [
                'allowed' => false,
                'reason' => '检测到异常行为，请稍后再试',
                'patterns' => $suspiciousPatterns
            ];
        }
        
        return ['allowed' => true];
    }

    private function detectSuspiciousPatterns(int $userId, string $ip, string $feature): array
    {
        $patterns = [];
        
        $recentRequests = $this->db->queryOne(
            'SELECT COUNT(*) as count FROM token_usage 
             WHERE (user_id = ? OR ip_address = ?) AND created_at > DATE_SUB(NOW(), INTERVAL 1 MINUTE)',
            [$userId, $ip]
        );
        
        if ($recentRequests && $recentRequests['count'] > 30) {
            $patterns[] = 'high_frequency';
        }
        
        $identicalRequests = $this->db->queryOne(
            'SELECT COUNT(*) as count FROM token_usage 
             WHERE user_id = ? AND request_type = ? AND created_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)',
            [$userId, $feature]
        );
        
        if ($identicalRequests && $identicalRequests['count'] > 10) {
            $patterns[] = 'repeated_feature';
        }
        
        $ipUsers = $this->db->queryOne(
            'SELECT COUNT(DISTINCT user_id) as count FROM token_usage 
             WHERE ip_address = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)',
            [$ip]
        );
        
        if ($ipUsers && $ipUsers['count'] > 5) {
            $patterns[] = 'multiple_accounts';
        }
        
        return $patterns;
    }

    public function checkDebounce(int $userId, string $requestHash, int $debounceSeconds = 3): array
    {
        $cacheKey = "debounce:{$userId}:{$requestHash}";
        $cacheFile = $this->getCacheFilePath($cacheKey);
        
        if (file_exists($cacheFile)) {
            $data = json_decode(file_get_contents($cacheFile), true);
            if ($data && $data['expires_at'] > time()) {
                return [
                    'debounced' => true,
                    'remaining_seconds' => $data['expires_at'] - time(),
                    'previous_request_id' => $data['request_id'] ?? null
                ];
            }
        }
        
        $requestId = $this->generateRequestId();
        $this->setFileCache($cacheKey, [
            'request_id' => $requestId,
            'expires_at' => time() + $debounceSeconds
        ], $debounceSeconds);
        
        return [
            'debounced' => false,
            'request_id' => $requestId
        ];
    }

    public function checkCache(string $requestHash): ?array
    {
        if (!($this->config['cache.enable_response_cache'] ?? true)) {
            return null;
        }
        
        $cacheEntry = $this->db->queryOne(
            'SELECT * FROM cache_entries WHERE request_hash = ? AND expires_at > NOW()',
            [$requestHash]
        );
        
        if ($cacheEntry) {
            $this->db->execute(
                'UPDATE cache_entries SET hit_count = hit_count + 1, last_hit_at = NOW() WHERE id = ?',
                [$cacheEntry['id']]
            );
            
            return [
                'hit' => true,
                'cache_key' => $cacheEntry['cache_key'],
                'value' => json_decode($cacheEntry['cache_value'], true),
                'model_id' => $cacheEntry['model_id'],
                'created_at' => $cacheEntry['created_at']
            ];
        }
        
        return null;
    }

    public function setCache(string $requestHash, string $modelId, string $feature, mixed $value): bool
    {
        if (!($this->config['cache.enable_response_cache'] ?? true)) {
            return false;
        }
        
        $ttl = (int) ($this->config['cache.ttl_seconds'] ?? 86400);
        $cacheKey = md5($requestHash);
        
        return $this->db->insert('cache_entries', [
            'cache_key' => $cacheKey,
            'cache_value' => json_encode($value),
            'request_hash' => $requestHash,
            'model_id' => $modelId,
            'feature' => $feature,
            'hit_count' => 0,
            'expires_at' => date('Y-m-d H:i:s', time() + $ttl)
        ]) > 0;
    }

    public function checkBudget(): array
    {
        $dailyLimit = $this->config['budget.daily_limit'] ?? 1000;
        $monthlyLimit = $this->config['budget.monthly_limit'] ?? 20000;
        
        $dailyCost = $this->db->queryOne(
            'SELECT COALESCE(SUM(total_tokens), 0) as total FROM token_usage WHERE DATE(created_at) = CURDATE()'
        );
        $dailyCost = (float) ($dailyCost['total'] ?? 0);
        
        $monthlyCost = $this->db->queryOne(
            'SELECT COALESCE(SUM(total_tokens), 0) as total FROM token_usage WHERE created_at >= DATE_FORMAT(NOW(), "%Y-%m-01")'
        );
        $monthlyCost = (float) ($monthlyCost['total'] ?? 0);
        
        $dailyExceeded = $dailyCost >= $dailyLimit;
        $monthlyExceeded = $monthlyCost >= $monthlyLimit;
        
        return [
            'daily' => [
                'cost' => $dailyCost,
                'limit' => $dailyLimit,
                'exceeded' => $dailyExceeded,
                'percentage' => $dailyLimit > 0 ? ($dailyCost / $dailyLimit) * 100 : 0
            ],
            'monthly' => [
                'cost' => $monthlyCost,
                'limit' => $monthlyLimit,
                'exceeded' => $monthlyExceeded,
                'percentage' => $monthlyLimit > 0 ? ($monthlyCost / $monthlyLimit) * 100 : 0
            ],
            'circuit_breaker' => $dailyExceeded || $monthlyExceeded
        ];
    }

    public function shouldTriggerCircuitBreaker(): bool
    {
        if (!($this->config['budget.enable_circuit_breaker'] ?? true)) {
            return false;
        }
        
        $budget = $this->checkBudget();
        return $budget['circuit_breaker'];
    }

    public function getFallbackModel(): string
    {
        return $this->config['budget.fallback_model'] ?? 'gemini-2.5-flash';
    }

    public function truncatePrompt(string $prompt, int $maxLength = 8000): string
    {
        if (mb_strlen($prompt) <= $maxLength) {
            return $prompt;
        }
        
        $truncated = mb_substr($prompt, 0, $maxLength - 100);
        
        $lastPeriod = mb_strrpos($truncated, '。');
        $lastQuestion = mb_strrpos($truncated, '？');
        $lastExclaim = mb_strrpos($truncated, '！');
        $lastSentence = max($lastPeriod, $lastQuestion, $lastExclaim);
        
        if ($lastSentence > $maxLength * 0.7) {
            $truncated = mb_substr($truncated, 0, $lastSentence + 1);
        }
        
        return $truncated . "\n\n[提示词已自动截断，原长度: " . mb_strlen($prompt) . " 字符]";
    }

    public function generateRequestHash(string $feature, array $params): string
    {
        $normalizedParams = $this->normalizeParams($params);
        return hash('sha256', $feature . ':' . json_encode($normalizedParams));
    }

    private function normalizeParams(array $params): array
    {
        ksort($params);
        
        foreach ($params as $key => $value) {
            if (is_array($value)) {
                $params[$key] = $this->normalizeParams($value);
            } elseif (is_string($value) && strlen($value) > 1000) {
                $params[$key] = md5($value);
            }
        }
        
        return $params;
    }

    private function generateRequestId(): string
    {
        return 'req_' . uniqid() . '_' . bin2hex(random_bytes(4));
    }

    private function getCacheFilePath(string $key): string
    {
        $hash = md5($key);
        return $this->cachePath . '/' . substr($hash, 0, 2) . '/' . $hash . '.json';
    }

    private function setFileCache(string $key, mixed $value, int $ttl): bool
    {
        $cacheFile = $this->getCacheFilePath($key);
        $dir = dirname($cacheFile);
        
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        
        $data = [
            'value' => $value,
            'expires_at' => time() + $ttl
        ];
        
        return file_put_contents($cacheFile, json_encode($data)) !== false;
    }

    public function logUsage(array $data): int
    {
        return $this->db->insert('token_usage', [
            'user_id' => $data['user_id'],
            'request_id' => $data['request_id'],
            'model' => $data['model_id'],
            'prompt_tokens' => $data['prompt_tokens'] ?? 0,
            'completion_tokens' => $data['completion_tokens'] ?? 0,
            'total_tokens' => ($data['prompt_tokens'] ?? 0) + ($data['completion_tokens'] ?? 0),
            'request_type' => $data['feature'],
            'ip_address' => $data['ip_address'],
            'created_at' => date('Y-m-d H:i:s')
        ]);
    }

    public function getCostReport(string $period = 'today'): array
    {
        $whereClause = match ($period) {
            'today' => 'DATE(created_at) = CURDATE()',
            'week' => 'created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)',
            'month' => 'created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)',
            'all' => '1=1',
            default => 'DATE(created_at) = CURDATE()'
        };
        
        $byFeature = $this->db->query(
            "SELECT request_type as feature, 
                    COUNT(*) as request_count,
                    SUM(total_tokens) as total_points,
                    SUM(total_tokens) as total_cost,
                    0 as avg_latency
             FROM token_usage 
             WHERE {$whereClause}
             GROUP BY request_type"
        );
        
        $byModel = $this->db->query(
            "SELECT model,
                    COUNT(*) as request_count,
                    SUM(total_tokens) as total_points,
                    SUM(total_tokens) as total_cost
             FROM token_usage 
             WHERE {$whereClause}
             GROUP BY model"
        );
        
        $byChannel = $this->db->query(
            "SELECT 'default' as channel_id,
                    COUNT(*) as request_count,
                    COUNT(*) as success_count,
                    0 as failed_count,
                    0 as avg_latency
             FROM token_usage 
             WHERE {$whereClause}
             GROUP BY 'default'"
        );
        
        return [
            'period' => $period,
            'by_feature' => $byFeature,
            'by_model' => $byModel,
            'by_channel' => $byChannel
        ];
    }
}
