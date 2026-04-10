<?php
/**
 * 首席图像架构师 - 中间件基类
 * 
 * @package KbitArchitect
 * @version 1.0.0
 */

namespace KbitArchitect\Middleware;

abstract class Middleware
{
    protected function json(array $data, int $status = 200): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_UNICODE);
        exit;
    }

    protected function error(string $message, int $status = 400): void
    {
        $this->json([
            'success' => false,
            'error' => $message
        ], $status);
    }

    abstract public function handle(): bool;
}
