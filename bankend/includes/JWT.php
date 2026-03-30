<?php
/**
 * 首席图像架构师 - JWT处理类
 * 
 * @package KbitArchitect
 * @version 1.0.0
 */

namespace KbitArchitect\Core;

use RuntimeException;
use InvalidArgumentException;
use KbitArchitect\Core\Database;

class JWT
{
    private static array $config;

    public static function init(array $config): void
    {
        self::$config = $config;
    }

    public static function encode(array $payload): string
    {
        $header = [
            'typ' => 'JWT',
            'alg' => self::$config['algorithm']
        ];

        $now = time();
        $payload = array_merge($payload, [
            'iat' => $now,
            'iss' => self::$config['issuer'],
            'aud' => self::$config['audience'],
            'jti' => bin2hex(random_bytes(16))
        ]);

        if (!isset($payload['exp'])) {
            $payload['exp'] = $now + self::$config['access_token']['ttl'];
        }

        $headerEncoded = self::base64UrlEncode(json_encode($header));
        $payloadEncoded = self::base64UrlEncode(json_encode($payload));
        $signature = self::sign($headerEncoded . '.' . $payloadEncoded);

        return $headerEncoded . '.' . $payloadEncoded . '.' . $signature;
    }

    public static function decode(string $token): array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            throw new InvalidArgumentException('Invalid token format');
        }

        [$headerEncoded, $payloadEncoded, $signature] = $parts;

        if (!self::verify($headerEncoded . '.' . $payloadEncoded, $signature)) {
            throw new RuntimeException('Invalid token signature');
        }

        $payload = json_decode(self::base64UrlDecode($payloadEncoded), true);
        
        if (!$payload) {
            throw new RuntimeException('Invalid token payload');
        }

        $leeway = self::$config['access_token']['leeway'] ?? 0;
        
        if (isset($payload['exp']) && $payload['exp'] < (time() - $leeway)) {
            throw new RuntimeException('Token has expired');
        }

        if (self::$config['blacklist_enabled'] ?? false) {
            if (self::isBlacklisted($payload['jti'] ?? '')) {
                throw new RuntimeException('Token has been revoked');
            }
        }

        return $payload;
    }

    public static function generateAccessToken(int $userId, string $tier): string
    {
        return self::encode([
            'sub' => $userId,
            'type' => 'access',
            'tier' => $tier,
            'exp' => time() + self::$config['access_token']['ttl']
        ]);
    }

    public static function generateRefreshToken(int $userId): string
    {
        return self::encode([
            'sub' => $userId,
            'type' => 'refresh',
            'exp' => time() + self::$config['refresh_token']['ttl']
        ]);
    }

    public static function generateTokenPair(int $userId, string $tier): array
    {
        return [
            'access_token' => self::generateAccessToken($userId, $tier),
            'refresh_token' => self::generateRefreshToken($userId),
            'token_type' => 'Bearer',
            'expires_in' => self::$config['access_token']['ttl']
        ];
    }

    public static function invalidate(string $token): bool
    {
        if (!self::$config['blacklist_enabled']) {
            return true;
        }

        try {
            $payload = self::decode($token);
            $jti = $payload['jti'] ?? null;
            $userId = $payload['sub'] ?? null;
            $exp = $payload['exp'] ?? null;

            if (!$jti || !$userId || !$exp) {
                return false;
            }

            $db = Database::getInstance();
            $db->insert('token_blacklist', [
                'token_jti' => $jti,
                'user_id' => $userId,
                'reason' => 'logout',
                'expires_at' => date('Y-m-d H:i:s', $exp)
            ]);

            return true;
        } catch (\Exception $e) {
            return false;
        }
    }

    private static function isBlacklisted(string $jti): bool
    {
        if (empty($jti)) {
            return false;
        }

        $db = Database::getInstance();
        $result = $db->queryOne(
            'SELECT id FROM token_blacklist WHERE token_jti = ? AND expires_at > NOW()',
            [$jti]
        );

        return $result !== null;
    }

    private static function sign(string $data): string
    {
        return self::base64UrlEncode(
            hash_hmac('sha256', $data, self::$config['secret_key'], true)
        );
    }

    private static function verify(string $data, string $signature): bool
    {
        $expectedSignature = self::sign($data);
        return hash_equals($expectedSignature, $signature);
    }

    private static function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function base64UrlDecode(string $data): string
    {
        return base64_decode(strtr($data, '-_', '+/'));
    }

    public static function extractFromHeader(string $authHeader): ?string
    {
        if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
            return $matches[1];
        }
        return null;
    }
}
