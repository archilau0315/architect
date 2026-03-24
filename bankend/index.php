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
        'message' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
