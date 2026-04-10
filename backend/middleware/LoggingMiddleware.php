<?php
/**
 * 首席图像架构师 - 日志中间件
 *
 * @package KbitArchitect
 * @version 1.0.0
 */

namespace KbitArchitect\Middleware;

use KbitArchitect\Core\Database;

class LoggingMiddleware
{
    private Database $db;
    private float $startTime;
    private array $request;

    public function __construct()
    {
        $this->db = Database::getInstance();
        $this->startTime = microtime(true);
    }

    public function handle(array $request, callable $next): array
    {
        $this->request = $request;
        $this->startTime = microtime(true);

        // 记录请求开始
        $this->logRequest('start');

        try {
            $response = $next($request);

            // 记录请求成功
            $this->logRequest('success', $response);

            return $response;
        } catch (\Exception $e) {
            // 记录请求失败
            $this->logRequest('error', null, $e);
            throw $e;
        }
    }

    private function logRequest(string $status, ?array $response = null, ?\Exception $error = null): void
    {
        $duration = (microtime(true) - $this->startTime) * 1000; // 转换为毫秒
        $method = $this->request['method'] ?? 'UNKNOWN';
        $path = $this->request['path'] ?? '/';
        $userId = $GLOBALS['auth_user']['id'] ?? null;
        $ip = $this->request['ip'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';

        // 只在请求完成时记录到数据库
        if ($status !== 'start') {
            try {
                $statusCode = $response['code'] ?? ($error ? 500 : 200);
                $errorMessage = $error ? $error->getMessage() : null;

                $this->db->insert('monitoring_logs', [
                    'type' => 'api',
                    'endpoint' => $path,
                    'method' => $method,
                    'status_code' => $statusCode,
                    'duration_ms' => round($duration, 2),
                    'user_id' => $userId ?? 0,
                    'ip_address' => $ip,
                    'user_agent' => substr($userAgent, 0, 255),
                    'error_message' => $errorMessage
                ]);
            } catch (\Exception $e) {
                // 日志记录失败不应影响主流程
                error_log('[日志中间件] 记录失败: ' . $e->getMessage());
            }
        }

        // 记录到文件日志
        $logLevel = $error ? 'ERROR' : ($duration > 1000 ? 'WARN' : 'INFO');
        $logMessage = sprintf(
            '[%s] %s %s - %dms - User:%s IP:%s Status:%s',
            $logLevel,
            $method,
            $path,
            round($duration),
            $userId ?? 'guest',
            $ip,
            $status
        );

        if ($error) {
            $logMessage .= ' - Error: ' . $error->getMessage();
        }

        error_log($logMessage);
    }

    public static function middleware(): callable
    {
        return function(array $request, callable $next): array {
            $instance = new self();
            return $instance->handle($request, $next);
        };
    }
}
