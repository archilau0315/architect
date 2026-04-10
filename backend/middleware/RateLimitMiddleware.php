<?php
/**
 * 首席图像架构师 - 限流中间件
 * 
 * @package KbitArchitect
 * @version 1.0.0
 */

namespace KbitArchitect\Middleware;

use KbitArchitect\Core\Database;

class RateLimitMiddleware extends Middleware
{
    private string $identifier;
    private int $maxRequests;
    private int $windowSeconds;
    private string $type;

    public function __construct(string $type = 'ip', int $maxRequests = 60, int $windowSeconds = 60)
    {
        $this->type = $type;
        $this->maxRequests = $maxRequests;
        $this->windowSeconds = $windowSeconds;
        
        $this->identifier = $this->getIdentifier();
    }

    public function handle(): bool
    {
        $key = $this->getCacheKey();
        $current = $this->getCurrentCount($key);

        if ($current >= $this->maxRequests) {
            $this->error('Too many requests. Please try again later.', 429);
            return false;
        }

        $this->incrementCount($key);
        
        header('X-RateLimit-Limit: ' . $this->maxRequests);
        header('X-RateLimit-Remaining: ' . max(0, $this->maxRequests - $current - 1));
        header('X-RateLimit-Reset: ' . (time() + $this->windowSeconds));

        return true;
    }

    private function getIdentifier(): string
    {
        switch ($this->type) {
            case 'user':
                return 'user_' . ($GLOBALS['auth_user']['id'] ?? 'anonymous');
            case 'ip':
            default:
                return 'ip_' . $this->getClientIp();
        }
    }

    private function getClientIp(): string
    {
        $headers = [
            'HTTP_CF_CONNECTING_IP',
            'HTTP_X_FORWARDED_FOR',
            'HTTP_X_REAL_IP',
            'REMOTE_ADDR'
        ];

        foreach ($headers as $header) {
            if (!empty($_SERVER[$header])) {
                $ip = $_SERVER[$header];
                if (strpos($ip, ',') !== false) {
                    $ip = trim(explode(',', $ip)[0]);
                }
                if (filter_var($ip, FILTER_VALIDATE_IP)) {
                    return $ip;
                }
            }
        }

        return 'unknown';
    }

    private function getCacheKey(): string
    {
        $window = floor(time() / $this->windowSeconds);
        return "rate_limit:{$this->identifier}:{$window}";
    }

    private function getCurrentCount(string $key): int
    {
        $cacheFile = $this->getCacheFilePath($key);
        
        if (!file_exists($cacheFile)) {
            return 0;
        }

        $data = json_decode(file_get_contents($cacheFile), true);
        
        if ($data['expires_at'] < time()) {
            unlink($cacheFile);
            return 0;
        }

        return $data['count'] ?? 0;
    }

    private function incrementCount(string $key): void
    {
        $cacheFile = $this->getCacheFilePath($key);
        $count = $this->getCurrentCount($key) + 1;

        $data = [
            'count' => $count,
            'expires_at' => time() + $this->windowSeconds
        ];

        $dir = dirname($cacheFile);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        file_put_contents($cacheFile, json_encode($data));
    }

    private function getCacheFilePath(string $key): string
    {
        $hash = md5($key);
        return __DIR__ . '/../../storage/cache/rate_limit/' . substr($hash, 0, 2) . '/' . $hash . '.json';
    }

    public static function forFeature(string $feature): self
    {
        $db = Database::getInstance();
        $userId = $GLOBALS['auth_user']['id'] ?? null;
        $userTier = $GLOBALS['auth_user']['tier'] ?? 'free';

        $rule = $db->queryOne(
            'SELECT * FROM rate_limits WHERE feature = ? AND (user_tier = ? OR user_tier = "all") AND is_active = 1 ORDER BY priority DESC LIMIT 1',
            [$feature, $userTier]
        );

        if ($rule) {
            return new self('user', $rule['max_requests'], $rule['window_seconds']);
        }

        return new self('user', 60, 60);
    }
}
