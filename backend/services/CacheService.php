<?php
/**
 * 首席图像架构师 - 缓存服务
 *
 * @package KbitArchitect
 * @version 1.0.0
 */

namespace KbitArchitect\Services;

class CacheService
{
    private static ?CacheService $instance = null;
    private array $cache = [];
    private array $expiry = [];
    private bool $redisAvailable = false;
    private $redis = null;

    private function __construct()
    {
        // 尝试连接 Redis
        if (class_exists('Redis')) {
            try {
                $this->redis = new \Redis();
                $this->redis->connect(
                    $_ENV['REDIS_HOST'] ?? 'localhost',
                    (int) ($_ENV['REDIS_PORT'] ?? 6379)
                );

                if (!empty($_ENV['REDIS_PASSWORD'])) {
                    $this->redis->auth($_ENV['REDIS_PASSWORD']);
                }

                $this->redis->select((int) ($_ENV['REDIS_DB'] ?? 0));
                $this->redisAvailable = true;
                error_log('[缓存] Redis 连接成功');
            } catch (\Exception $e) {
                error_log('[缓存] Redis 连接失败，使用内存缓存: ' . $e->getMessage());
                $this->redisAvailable = false;
            }
        }
    }

    public static function getInstance(): self
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function get(string $key, $default = null)
    {
        if ($this->redisAvailable) {
            try {
                $value = $this->redis->get($key);
                if ($value === false) {
                    return $default;
                }
                return json_decode($value, true);
            } catch (\Exception $e) {
                error_log('[缓存] Redis 读取失败: ' . $e->getMessage());
            }
        }

        // 内存缓存
        if (isset($this->expiry[$key]) && $this->expiry[$key] < time()) {
            unset($this->cache[$key], $this->expiry[$key]);
            return $default;
        }

        return $this->cache[$key] ?? $default;
    }

    public function set(string $key, $value, int $ttl = 3600): bool
    {
        if ($this->redisAvailable) {
            try {
                return $this->redis->setex($key, $ttl, json_encode($value));
            } catch (\Exception $e) {
                error_log('[缓存] Redis 写入失败: ' . $e->getMessage());
            }
        }

        // 内存缓存
        $this->cache[$key] = $value;
        $this->expiry[$key] = time() + $ttl;
        return true;
    }

    public function delete(string $key): bool
    {
        if ($this->redisAvailable) {
            try {
                return $this->redis->del($key) > 0;
            } catch (\Exception $e) {
                error_log('[缓存] Redis 删除失败: ' . $e->getMessage());
            }
        }

        // 内存缓存
        unset($this->cache[$key], $this->expiry[$key]);
        return true;
    }

    public function has(string $key): bool
    {
        if ($this->redisAvailable) {
            try {
                return $this->redis->exists($key) > 0;
            } catch (\Exception $e) {
                error_log('[缓存] Redis 检查失败: ' . $e->getMessage());
            }
        }

        // 内存缓存
        if (!isset($this->cache[$key])) {
            return false;
        }

        if (isset($this->expiry[$key]) && $this->expiry[$key] < time()) {
            unset($this->cache[$key], $this->expiry[$key]);
            return false;
        }

        return true;
    }

    public function clear(): bool
    {
        if ($this->redisAvailable) {
            try {
                return $this->redis->flushDB();
            } catch (\Exception $e) {
                error_log('[缓存] Redis 清空失败: ' . $e->getMessage());
            }
        }

        // 内存缓存
        $this->cache = [];
        $this->expiry = [];
        return true;
    }

    public function remember(string $key, int $ttl, callable $callback)
    {
        if ($this->has($key)) {
            return $this->get($key);
        }

        $value = $callback();
        $this->set($key, $value, $ttl);
        return $value;
    }

    public function getStats(): array
    {
        if ($this->redisAvailable) {
            try {
                $info = $this->redis->info();
                return [
                    'type' => 'redis',
                    'connected' => true,
                    'keys' => $this->redis->dbSize(),
                    'memory_used' => $info['used_memory_human'] ?? 'N/A',
                    'hits' => $info['keyspace_hits'] ?? 0,
                    'misses' => $info['keyspace_misses'] ?? 0
                ];
            } catch (\Exception $e) {
                return ['type' => 'redis', 'connected' => false, 'error' => $e->getMessage()];
            }
        }

        return [
            'type' => 'memory',
            'keys' => count($this->cache),
            'memory_used' => memory_get_usage(true)
        ];
    }

    public function isRedisAvailable(): bool
    {
        return $this->redisAvailable;
    }
}
