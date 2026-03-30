<?php
/**
 * 首席图像架构师 - API路由定义
 * 
 * @package KbitArchitect
 * @version 1.0.0
 */

use KbitArchitect\Core\Router;
use KbitArchitect\Middleware\AuthMiddleware;
use KbitArchitect\Middleware\RateLimitMiddleware;

$authMiddleware = [AuthMiddleware::class];

Router::post('/api/auth/register', function($req) {
    $controller = new \KbitArchitect\Controllers\AuthController();
    return $controller->register($req);
});

Router::post('/api/auth/login', function($req) {
    $controller = new \KbitArchitect\Controllers\AuthController();
    return $controller->login($req);
});

Router::post('/api/auth/logout', function($req) {
    $controller = new \KbitArchitect\Controllers\AuthController();
    return $controller->logout($req);
}, $authMiddleware);

Router::post('/api/auth/refresh', function($req) {
    $controller = new \KbitArchitect\Controllers\AuthController();
    return $controller->refresh($req);
});

Router::post('/api/auth/send-code', function($req) {
    $controller = new \KbitArchitect\Controllers\AuthController();
    return $controller->sendVerificationCode($req);
});

Router::post('/api/auth/verify-code', function($req) {
    $controller = new \KbitArchitect\Controllers\AuthController();
    return $controller->verifyCode($req);
});

Router::post('/api/auth/reset-password', function($req) {
    $controller = new \KbitArchitect\Controllers\AuthController();
    return $controller->resetPassword($req);
});

Router::get('/api/auth/me', function($req) {
    $controller = new \KbitArchitect\Controllers\AuthController();
    return $controller->me($req);
}, $authMiddleware);

Router::put('/api/auth/profile', function($req) {
    $controller = new \KbitArchitect\Controllers\AuthController();
    return $controller->updateProfile($req);
}, $authMiddleware);

Router::post('/api/auth/change-password', function($req) {
    $controller = new \KbitArchitect\Controllers\AuthController();
    return $controller->changePassword($req);
}, $authMiddleware);

Router::get('/api/user/profile', function($req) {
    $controller = new \KbitArchitect\Controllers\UserController();
    return $controller->getProfile($req);
}, $authMiddleware);

Router::get('/api/user/quota', function($req) {
    $controller = new \KbitArchitect\Controllers\UserController();
    return $controller->getQuota($req);
}, $authMiddleware);

Router::get('/api/user/usage', function($req) {
    $controller = new \KbitArchitect\Controllers\UserController();
    return $controller->getUsageStats($req);
}, $authMiddleware);

Router::get('/api/user/transactions', function($req) {
    $controller = new \KbitArchitect\Controllers\UserController();
    return $controller->getTransactionHistory($req);
}, $authMiddleware);

Router::post('/api/user/purchase-points', function($req) {
    $controller = new \KbitArchitect\Controllers\UserController();
    return $controller->purchasePoints($req);
}, $authMiddleware);

Router::get('/api/subscription/plans', function($req) {
    $controller = new \KbitArchitect\Controllers\SubscriptionController();
    return $controller->getPlans($req);
});

Router::post('/api/subscription/subscribe', function($req) {
    $controller = new \KbitArchitect\Controllers\SubscriptionController();
    return $controller->subscribe($req);
}, $authMiddleware);

Router::post('/api/subscription/activate-license', function($req) {
    $controller = new \KbitArchitect\Controllers\SubscriptionController();
    return $controller->activateLicense($req);
}, $authMiddleware);

Router::get('/api/subscription/current', function($req) {
    $controller = new \KbitArchitect\Controllers\SubscriptionController();
    return $controller->getCurrentSubscription($req);
}, $authMiddleware);

Router::get('/api/subscription/history', function($req) {
    $controller = new \KbitArchitect\Controllers\SubscriptionController();
    return $controller->getHistory($req);
}, $authMiddleware);

Router::post('/api/subscription/cancel', function($req) {
    $controller = new \KbitArchitect\Controllers\SubscriptionController();
    return $controller->cancel($req);
}, $authMiddleware);

Router::get('/api/subscription/check-upgrade', function($req) {
    $controller = new \KbitArchitect\Controllers\SubscriptionController();
    return $controller->checkUpgrade($req);
}, $authMiddleware);

Router::post('/api/routing/select', function($req) {
    $controller = new \KbitArchitect\Controllers\RoutingController();
    return $controller->selectModel($req);
}, $authMiddleware);

Router::get('/api/routing/models', function($req) {
    $controller = new \KbitArchitect\Controllers\RoutingController();
    return $controller->getAvailableModels($req);
}, $authMiddleware);

Router::get('/api/routing/channels', function($req) {
    $controller = new \KbitArchitect\Controllers\RoutingController();
    return $controller->getChannels($req);
}, $authMiddleware);

Router::post('/api/routing/check-quota', function($req) {
    $controller = new \KbitArchitect\Controllers\RoutingController();
    return $controller->checkQuota($req);
}, $authMiddleware);

Router::post('/api/routing/pre-deduct', function($req) {
    $controller = new \KbitArchitect\Controllers\RoutingController();
    return $controller->preDeduct($req);
}, $authMiddleware);

Router::post('/api/routing/refund', function($req) {
    $controller = new \KbitArchitect\Controllers\RoutingController();
    return $controller->refund($req);
}, $authMiddleware);

Router::post('/api/routing/log-usage', function($req) {
    $controller = new \KbitArchitect\Controllers\RoutingController();
    return $controller->logUsage($req);
}, $authMiddleware);

Router::post('/api/routing/check-cache', function($req) {
    $controller = new \KbitArchitect\Controllers\RoutingController();
    return $controller->checkCache($req);
}, $authMiddleware);

Router::post('/api/routing/set-cache', function($req) {
    $controller = new \KbitArchitect\Controllers\RoutingController();
    return $controller->setCache($req);
}, $authMiddleware);

Router::get('/api/routing/budget', function($req) {
    $controller = new \KbitArchitect\Controllers\RoutingController();
    return $controller->getBudgetStatus($req);
}, $authMiddleware);

Router::get('/api/routing/cost-report', function($req) {
    $controller = new \KbitArchitect\Controllers\RoutingController();
    return $controller->getCostReport($req);
}, $authMiddleware);

Router::post('/api/admin/login', function($req) {
    $controller = new \KbitArchitect\Controllers\AdminController();
    return $controller->login($req);
});

Router::get('/api/admin/dashboard', function($req) {
    $controller = new \KbitArchitect\Controllers\AdminController();
    return $controller->getDashboard($req);
}, $authMiddleware);

Router::get('/api/admin/users', function($req) {
    $controller = new \KbitArchitect\Controllers\AdminController();
    return $controller->getUsers($req);
}, $authMiddleware);

Router::get('/api/admin/users/{id}', function($req) {
    $controller = new \KbitArchitect\Controllers\AdminController();
    return $controller->getUserDetail($req);
}, $authMiddleware);

Router::put('/api/admin/users/{id}', function($req) {
    $controller = new \KbitArchitect\Controllers\AdminController();
    return $controller->updateUser($req);
}, $authMiddleware);

Router::delete('/api/admin/users/{id}', function($req) {
    $controller = new \KbitArchitect\Controllers\AdminController();
    return $controller->deleteUser($req);
}, $authMiddleware);

Router::get('/api/admin/models', function($req) {
    $controller = new \KbitArchitect\Controllers\AdminController();
    return $controller->getModels($req);
}, $authMiddleware);

Router::post('/api/admin/models', function($req) {
    $controller = new \KbitArchitect\Controllers\AdminController();
    return $controller->addModel($req);
}, $authMiddleware);

Router::put('/api/admin/models/{id}', function($req) {
    $controller = new \KbitArchitect\Controllers\AdminController();
    return $controller->updateModel($req);
}, $authMiddleware);

Router::get('/api/admin/channels', function($req) {
    $controller = new \KbitArchitect\Controllers\AdminController();
    return $controller->getChannels($req);
}, $authMiddleware);

Router::put('/api/admin/channels/{id}', function($req) {
    $controller = new \KbitArchitect\Controllers\AdminController();
    return $controller->updateChannel($req);
}, $authMiddleware);

Router::get('/api/admin/configs', function($req) {
    $controller = new \KbitArchitect\Controllers\AdminController();
    return $controller->getConfigs($req);
}, $authMiddleware);

Router::put('/api/admin/configs/{key}', function($req) {
    $controller = new \KbitArchitect\Controllers\AdminController();
    return $controller->updateConfig($req);
}, $authMiddleware);

Router::get('/api/admin/logs', function($req) {
    $controller = new \KbitArchitect\Controllers\AdminController();
    return $controller->getUsageLogs($req);
}, $authMiddleware);

Router::get('/api/admin/cost-report', function($req) {
    $controller = new \KbitArchitect\Controllers\AdminController();
    return $controller->getCostReport($req);
}, $authMiddleware);

Router::get('/api/admin/routing-rules', function($req) {
    $controller = new \KbitArchitect\Controllers\AdminController();
    return $controller->getRoutingRules($req);
}, $authMiddleware);

Router::put('/api/admin/routing-rules/{id}', function($req) {
    $controller = new \KbitArchitect\Controllers\AdminController();
    return $controller->updateRoutingRule($req);
}, $authMiddleware);

// 内测申请相关路由
Router::get('/api/admin/beta-requests', function($req) {
    $controller = new \KbitArchitect\Controllers\AdminController();
    return $controller->getBetaRequests($req);
}, $authMiddleware);

Router::post('/api/admin/beta-requests/{id}/approve', function($req) {
    $controller = new \KbitArchitect\Controllers\AdminController();
    return $controller->approveBetaRequest($req);
}, $authMiddleware);

Router::post('/api/admin/beta-requests/{id}/reject', function($req) {
    $controller = new \KbitArchitect\Controllers\AdminController();
    return $controller->rejectBetaRequest($req);
}, $authMiddleware);

Router::get('/api/health', function($req) {
    return [
        'success' => true,
        'data' => [
            'status' => 'healthy',
            'timestamp' => date('c'),
            'version' => '1.0.0'
        ]
    ];
});

Router::get('/api/config/public', function($req) {
    $db = \KbitArchitect\Core\Database::getInstance();
    $configs = $db->query(
        'SELECT config_key, config_value, config_type FROM system_config WHERE is_public = 1'
    );
    
    $result = [];
    foreach ($configs as $config) {
        $value = $config['config_value'];
        if ($config['config_type'] === 'number') {
            $value = (float) $value;
        } elseif ($config['config_type'] === 'boolean') {
            $value = filter_var($value, FILTER_VALIDATE_BOOLEAN);
        } elseif ($config['config_type'] === 'json') {
            $value = json_decode($value, true);
        }
        $result[$config['config_key']] = $value;
    }
    
    return [
        'success' => true,
        'data' => $result
    ];
});

// API代理路由 - 安全地代理第三方API请求
Router::post('/api/proxy/image', function($req) {
    $controller = new \KbitArchitect\Controllers\ProxyController();
    return $controller->imageGeneration($req);
}, $authMiddleware);

Router::post('/api/proxy/chat', function($req) {
    $controller = new \KbitArchitect\Controllers\ProxyController();
    return $controller->chatCompletion($req);
}, $authMiddleware);

Router::get('/api/proxy/status', function($req) {
    $controller = new \KbitArchitect\Controllers\ProxyController();
    return $controller->getStatus($req);
}, $authMiddleware);
