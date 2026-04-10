<?php
/**
 * 首席图像架构师 - 路由器类
 * 
 * @package KbitArchitect
 * @version 1.0.0
 */

namespace KbitArchitect\Core;

use RuntimeException;

class Router
{
    private static array $routes = [];
    private static array $middlewares = [];
    private static ?Router $instance = null;

    private function __construct() {}

    public static function getInstance(): self
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public static function get(string $path, callable $handler, array $middlewares = []): void
    {
        self::addRoute('GET', $path, $handler, $middlewares);
    }

    public static function post(string $path, callable $handler, array $middlewares = []): void
    {
        self::addRoute('POST', $path, $handler, $middlewares);
    }

    public static function put(string $path, callable $handler, array $middlewares = []): void
    {
        self::addRoute('PUT', $path, $handler, $middlewares);
    }

    public static function delete(string $path, callable $handler, array $middlewares = []): void
    {
        self::addRoute('DELETE', $path, $handler, $middlewares);
    }

    public static function group(array $options, callable $callback): void
    {
        $prefix = $options['prefix'] ?? '';
        $middlewares = $options['middleware'] ?? [];

        $previousRoutes = self::$routes;
        self::$routes = [];

        $callback();

        foreach (self::$routes as $route) {
            $route['path'] = $prefix . $route['path'];
            $route['middlewares'] = array_merge($middlewares, $route['middlewares']);
            $previousRoutes[] = $route;
        }

        self::$routes = $previousRoutes;
    }

    private static function addRoute(string $method, string $path, callable $handler, array $middlewares): void
    {
        self::$routes[] = [
            'method' => $method,
            'path' => $path,
            'handler' => $handler,
            'middlewares' => $middlewares
        ];
    }

    public function dispatch(): void
    {
        $method = $_SERVER['REQUEST_METHOD'];
        $uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

        if ($method === 'OPTIONS') {
            $this->handleCors();
            http_response_code(204);
            return;
        }

        $matched = false;
        foreach (self::$routes as $route) {
            if ($route['method'] !== $method) {
                continue;
            }

            $params = $this->matchRoute($route['path'], $uri);
            if ($params !== false) {
                $matched = true;
                $this->handleRoute($route, $params);
                break;
            }
        }

        if (!$matched) {
            $this->jsonResponse(['error' => 'Not Found', 'message' => 'Route not found'], 404);
        }
    }

    private function matchRoute(string $pattern, string $uri): array|false
    {
        $pattern = '#^' . preg_replace('/\{([a-zA-Z_]+)\}/', '(?P<$1>[^/]+)', $pattern) . '$#';
        
        if (preg_match($pattern, $uri, $matches)) {
            return array_filter($matches, 'is_string', ARRAY_FILTER_USE_KEY);
        }

        return false;
    }

    private function handleRoute(array $route, array $params): void
    {
        $this->handleCors();

        try {
            foreach ($route['middlewares'] as $middleware) {
                $middlewareInstance = new $middleware();
                $result = $middlewareInstance->handle();
                if ($result !== true) {
                    return;
                }
            }

            $request = $this->buildRequest($params);
            $response = call_user_func($route['handler'], $request);

            if (is_array($response)) {
                $this->jsonResponse($response);
            }
        } catch (\Exception $e) {
            $this->handleException($e);
        }
    }

    private function buildRequest(array $params): array
    {
        $body = [];
        $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
        
        if (stripos($contentType, 'application/json') !== false) {
            $body = json_decode(file_get_contents('php://input'), true) ?? [];
        } else {
            $body = $_POST;
        }

        return [
            'method' => $_SERVER['REQUEST_METHOD'],
            'uri' => $_SERVER['REQUEST_URI'],
            'params' => $params,
            'query' => $_GET,
            'body' => $body,
            'headers' => getallheaders(),
            'files' => $_FILES,
            'ip' => $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'],
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? ''
        ];
    }

    private function handleCors(): void
    {
        // 本地开发环境启用 CORS
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

        // 允许的来源
        $allowedOrigins = [
            'https://www.kbitai.com.cn',
            'https://kbitai.com.cn',
            'http://localhost:3000',
            'http://127.0.0.1:3000'
        ];

        if (in_array($origin, $allowedOrigins)) {
            header('Access-Control-Allow-Origin: ' . $origin);
        } else {
            // 生产环境默认允许主域名
            header('Access-Control-Allow-Origin: https://www.kbitai.com.cn');
        }

        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Max-Age: 86400');
        header('Content-Type: application/json; charset=utf-8');
    }

    public function jsonResponse(array $data, int $status = 200): void
    {
        http_response_code($status);
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    }

    private function handleException(\Exception $e): void
    {
        $statusCode = $e instanceof \InvalidArgumentException ? 400 : 500;
        
        if ($e instanceof RuntimeException && strpos($e->getMessage(), 'Token') !== false) {
            $statusCode = 401;
        }

        $this->jsonResponse([
            'success' => false,
            'error' => $e->getMessage(),
            'code' => $statusCode
        ], $statusCode);
    }

    public function getRoutes(): array
    {
        $routes = [];
        foreach (self::$routes as $route) {
            $method = $route['method'];
            $path = $route['path'];
            if (!isset($routes[$method])) {
                $routes[$method] = [];
            }
            $routes[$method][$path] = $route['handler'];
        }
        return $routes;
    }
}

if (!function_exists('getallheaders')) {
    function getallheaders(): array
    {
        $headers = [];
        foreach ($_SERVER as $name => $value) {
            if (substr($name, 0, 5) == 'HTTP_') {
                $headers[str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($name, 5)))))] = $value;
            }
        }
        return $headers;
    }
}
