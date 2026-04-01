<?php
/**
 * 首席图像架构师 - 后端入口文件
 *
 * @package KbitArchitect
 * @version 1.0.0
 * @author 天津匡形无界智能科技有限公司
 */

declare(strict_types=1);

error_reporting(E_ALL);
ini_set('display_errors', '0');

date_default_timezone_set('Asia/Shanghai');

// 加载 .env 文件
$envFile = __DIR__ . '/.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        // 跳过注释行
        if (empty($line) || strpos($line, '#') === 0) {
            continue;
        }
        // 解析 KEY=VALUE
        if (strpos($line, '=') !== false) {
            list($key, $value) = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value);
            // 去除引号
            if ((strpos($value, '"') === 0 && strrpos($value, '"') === strlen($value) - 1) ||
                (strpos($value, "'") === 0 && strrpos($value, "'") === strlen($value) - 1)) {
                $value = substr($value, 1, -1);
            }
            $_ENV[$key] = $value;
            $_SERVER[$key] = $value;
        }
    }
}

define('KBIT_ROOT', __DIR__);
define('KBIT_STORAGE', KBIT_ROOT . '/storage');

$storageDirs = [
    KBIT_STORAGE,
    KBIT_STORAGE . '/cache',
    KBIT_STORAGE . '/cache/rate_limit',
    KBIT_STORAGE . '/cache/response',
    KBIT_STORAGE . '/logs'
];

foreach ($storageDirs as $dir) {
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
}

require_once __DIR__ . '/includes/Database.php';
require_once __DIR__ . '/includes/JWT.php';
require_once __DIR__ . '/includes/Router.php';
require_once __DIR__ . '/includes/Mailer.php';
require_once __DIR__ . '/middleware/Middleware.php';
require_once __DIR__ . '/middleware/AuthMiddleware.php';
require_once __DIR__ . '/middleware/RateLimitMiddleware.php';
require_once __DIR__ . '/middleware/QuotaMiddleware.php';
require_once __DIR__ . '/models/User.php';
require_once __DIR__ . '/models/Subscription.php';
require_once __DIR__ . '/models/ModelRouter.php';
require_once __DIR__ . '/models/QuotaManager.php';
require_once __DIR__ . '/models/CostController.php';
require_once __DIR__ . '/controllers/AuthController.php';
require_once __DIR__ . '/controllers/UserController.php';
require_once __DIR__ . '/controllers/SubscriptionController.php';
require_once __DIR__ . '/controllers/RoutingController.php';
require_once __DIR__ . '/controllers/AdminController.php';

use KbitArchitect\Core\Database;
use KbitArchitect\Core\JWT;
use KbitArchitect\Core\Router;

try {
    $dbConfig = require __DIR__ . '/config/database.php';
    Database::getInstance($dbConfig['default']);
    
    $jwtConfig = require __DIR__ . '/config/jwt.php';
    JWT::init($jwtConfig);
    
    require __DIR__ . '/routes/api.php';
    
    $router = Router::getInstance();
    $router->dispatch();
    
} catch (Exception $e) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => false,
        'error' => 'Internal Server Error',
        'message' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine(),
        'trace' => $e->getTrace()
    ], JSON_UNESCAPED_UNICODE);
}