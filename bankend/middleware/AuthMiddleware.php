<?php
/**
 * 首席图像架构师 - 认证中间件
 * 
 * @package KbitArchitect
 * @version 1.0.0
 */

namespace KbitArchitect\Middleware;

use KbitArchitect\Core\JWT;
use KbitArchitect\Core\Database;

class AuthMiddleware extends Middleware
{
    public function handle(): bool
    {
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        $token = JWT::extractFromHeader($authHeader);

        if (!$token) {
            $this->error('Authorization token required', 401);
            return false;
        }

        try {
            $payload = JWT::decode($token);
            
            if (($payload['type'] ?? '') !== 'access') {
                $this->error('Invalid token type', 401);
                return false;
            }

            $GLOBALS['auth_user'] = [
                'id' => $payload['sub'],
                'tier' => $payload['tier'] ?? 'free',
                'jti' => $payload['jti'] ?? ''
            ];

            return true;
        } catch (\Exception $e) {
            $this->error('Invalid or expired token: ' . $e->getMessage(), 401);
            return false;
        }
    }

    public static function user(): ?array
    {
        return $GLOBALS['auth_user'] ?? null;
    }

    public static function userId(): ?int
    {
        return $GLOBALS['auth_user']['id'] ?? null;
    }

    public static function userTier(): string
    {
        return $GLOBALS['auth_user']['tier'] ?? 'free';
    }
}
