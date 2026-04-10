<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>仪表盘 - 管理员后台</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/font-awesome@4.7.0/css/font-awesome.min.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.8/dist/chart.umd.min.js"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        primary: '#4F46E5',
                        secondary: '#7C3AED',
                        success: '#10B981',
                        warning: '#F59E0B',
                        danger: '#EF4444',
                        info: '#3B82F6',
                    },
                    fontFamily: {
                        inter: ['Inter', 'sans-serif'],
                    },
                }
            }
        }
    </script>
    <style type="text/tailwindcss">
        @layer utilities {
            .content-auto {
                content-visibility: auto;
            }
            .bg-gradient-primary {
                background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);
            }
            .card-shadow {
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            }
        }
    </style>
</head>
<body class="bg-gray-50 font-inter">
    <!-- 侧边栏 -->
    <div class="flex h-screen overflow-hidden">
        <div class="w-64 bg-gray-900 text-white flex flex-col">
            <div class="p-6 border-b border-gray-800">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center">
                        <i class="fa fa-shield text-white"></i>
                    </div>
                    <div>
                        <h1 class="text-lg font-bold">管理员后台</h1>
                        <p class="text-xs text-gray-400">首席图像架构师</p>
                    </div>
                </div>
            </div>
            
            <nav class="flex-1 p-4 space-y-1">
                <a href="dashboard.php" class="flex items-center space-x-3 px-4 py-3 rounded-lg bg-gray-800 text-white">
                    <i class="fa fa-dashboard w-5 text-center"></i>
                    <span>仪表盘</span>
                </a>
                <a href="users.php" class="flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors">
                    <i class="fa fa-users w-5 text-center"></i>
                    <span>用户管理</span>
                </a>
                <a href="beta.php" class="flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors">
                    <i class="fa fa-envelope w-5 text-center"></i>
                    <span>内测申请</span>
                </a>
                <a href="models.php" class="flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors">
                    <i class="fa fa-cogs w-5 text-center"></i>
                    <span>系统配置</span>
                </a>
                <a href="logs.php" class="flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors">
                    <i class="fa fa-list-alt w-5 text-center"></i>
                    <span>使用日志</span>
                </a>
            </nav>
            
            <div class="p-4 border-t border-gray-800">
                <div class="flex items-center space-x-3 px-4 py-3">
                    <div class="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
                        <i class="fa fa-user"></i>
                    </div>
                    <div class="flex-1">
                        <p id="adminName" class="text-sm font-medium">管理员</p>
                        <p class="text-xs text-gray-400">超级管理员</p>
                    </div>
                    <button id="logoutButton" class="text-gray-400 hover:text-white">
                        <i class="fa fa-sign-out"></i>
                    </button>
                </div>
            </div>
        </div>
        
        <!-- 主内容 -->
        <div class="flex-1 flex flex-col overflow-hidden">
            <!-- 顶部导航 -->
            <header class="bg-white shadow-sm z-10">
                <div class="flex items-center justify-between p-4">
                    <div class="flex items-center space-x-4">
                        <button id="sidebarToggle" class="text-gray-500 hover:text-gray-700">
                            <i class="fa fa-bars"></i>
                        </button>
                        <h2 class="text-lg font-semibold text-gray-900">仪表盘</h2>
                    </div>
                    <div class="flex items-center space-x-4">
                        <div class="relative">
                            <button class="text-gray-500 hover:text-gray-700">
                                <i class="fa fa-bell"></i>
                                <span class="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
                            </button>
                        </div>
                        <div class="relative">
                            <button class="text-gray-500 hover:text-gray-700">
                                <i class="fa fa-cog"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </header>
            
            <!-- 内容区域 -->
            <main class="flex-1 overflow-y-auto p-6">
                <!-- 统计卡片 -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                    <div class="bg-white rounded-xl card-shadow p-6">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm text-gray-500">总用户数</p>
                                <h3 id="totalUsers" class="text-2xl font-bold text-gray-900">0</h3>
                            </div>
                            <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-primary">
                                <i class="fa fa-users text-xl"></i>
                            </div>
                        </div>
                        <div class="mt-4 flex items-center text-sm">
                            <span class="text-green-500 flex items-center">
                                <i class="fa fa-arrow-up mr-1"></i>
                                <span id="userGrowth">0%</span>
                            </span>
                            <span class="text-gray-500 ml-2">较上月</span>
                        </div>
                    </div>
                    
                    <div class="bg-white rounded-xl card-shadow p-6">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm text-gray-500">活跃用户</p>
                                <h3 id="activeUsers" class="text-2xl font-bold text-gray-900">0</h3>
                            </div>
                            <div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-success">
                                <i class="fa fa-user-circle text-xl"></i>
                            </div>
                        </div>
                        <div class="mt-4 flex items-center text-sm">
                            <span class="text-green-500 flex items-center">
                                <i class="fa fa-arrow-up mr-1"></i>
                                <span id="activeGrowth">0%</span>
                            </span>
                            <span class="text-gray-500 ml-2">较上周</span>
                        </div>
                    </div>
                    
                    <div class="bg-white rounded-xl card-shadow p-6">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm text-gray-500">今日请求</p>
                                <h3 id="todayRequests" class="text-2xl font-bold text-gray-900">0</h3>
                            </div>
                            <div class="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center text-secondary">
                                <i class="fa fa-refresh text-xl"></i>
                            </div>
                        </div>
                        <div class="mt-4 flex items-center text-sm">
                            <span class="text-green-500 flex items-center">
                                <i class="fa fa-arrow-up mr-1"></i>
                                <span id="requestGrowth">0%</span>
                            </span>
                            <span class="text-gray-500 ml-2">较昨日</span>
                        </div>
                    </div>
                    
                    <div class="bg-white rounded-xl card-shadow p-6">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm text-gray-500">今日成本</p>
                                <h3 id="todayCost" class="text-2xl font-bold text-gray-900">¥0.00</h3>
                            </div>
                            <div class="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center text-warning">
                                <i class="fa fa-money text-xl"></i>
                            </div>
                        </div>
                        <div class="mt-4 flex items-center text-sm">
                            <span class="text-red-500 flex items-center">
                                <i class="fa fa-arrow-up mr-1"></i>
                                <span id="costGrowth">0%</span>
                            </span>
                            <span class="text-gray-500 ml-2">较昨日</span>
                        </div>
                    </div>
                </div>
                
                <!-- 图表区域 -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    <div class="bg-white rounded-xl card-shadow p-6">
                        <div class="flex items-center justify-between mb-4">
                            <h3 class="text-lg font-semibold text-gray-900">用户分布</h3>
                            <div class="flex space-x-2">
                                <button class="px-3 py-1 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                                    周
                                </button>
                                <button class="px-3 py-1 text-sm bg-primary text-white rounded-lg">
                                    月
                                </button>
                                <button class="px-3 py-1 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                                    年
                                </button>
                            </div>
                        </div>
                        <div class="h-64">
                            <canvas id="userDistributionChart"></canvas>
                        </div>
                    </div>
                    
                    <div class="bg-white rounded-xl card-shadow p-6">
                        <div class="flex items-center justify-between mb-4">
                            <h3 class="text-lg font-semibold text-gray-900">功能使用</h3>
                            <select class="px-3 py-1 text-sm border border-gray-300 rounded-lg focus:ring-primary focus:border-primary">
                                <option>今日</option>
                                <option>本周</option>
                                <option>本月</option>
                            </select>
                        </div>
                        <div class="h-64">
                            <canvas id="featureUsageChart"></canvas>
                        </div>
                    </div>
                </div>
                
                <!-- 最近活动 -->
                <div class="bg-white rounded-xl card-shadow p-6">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-lg font-semibold text-gray-900">最近活动</h3>
                        <a href="logs.php" class="text-sm text-primary hover:text-secondary transition-colors">
                            查看全部
                        </a>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead>
                                <tr>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        时间
                                    </th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        用户
                                    </th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        操作
                                    </th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        状态
                                    </th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        详情
                                    </th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200" id="activityLog">
                                <!-- 活动记录将通过JavaScript动态添加 -->
                                <tr>
                                    <td colspan="5" class="px-6 py-10 text-center text-gray-500">
                                        加载中...
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    </div>
    
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            // 检查登录状态
            const adminToken = localStorage.getItem('admin_token');
            if (!adminToken) {
                window.location.href = 'index.php';
                return;
            }
            
            // 显示管理员信息
            const adminUser = localStorage.getItem('admin_user');
            if (adminUser) {
                const admin = JSON.parse(adminUser);
                document.getElementById('adminName').textContent = admin.username || '管理员';
            }
            
            // 退出登录
            document.getElementById('logoutButton').addEventListener('click', function() {
                localStorage.removeItem('admin_token');
                localStorage.removeItem('admin_user');
                window.location.href = 'index.php';
            });
            
            // 加载仪表盘数据
            loadDashboardData();
            
            // 加载最近活动
            loadRecentActivity();
        });
        
        function loadDashboardData() {
            fetch('/api/admin/dashboard', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Authorization': 'Bearer ' + localStorage.getItem('admin_token')
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const stats = data.data.stats;
                    
                    // 更新统计数据
                    document.getElementById('totalUsers').textContent = stats.total_users;
                    document.getElementById('activeUsers').textContent = stats.active_users;
                    document.getElementById('todayRequests').textContent = stats.today_requests;
                    document.getElementById('todayCost').textContent = '¥' + stats.today_cost.toFixed(2);
                    
                    // 更新图表数据
                    updateUserDistributionChart(data.data.tier_distribution);
                    updateFeatureUsageChart(data.data.feature_usage);
                }
            })
            .catch(error => {
                console.error('加载仪表盘数据失败:', error);
            });
        }
        
        function updateUserDistributionChart(tierData) {
            const ctx = document.getElementById('userDistributionChart').getContext('2d');
            
            const labels = tierData.map(item => {
                const tierMap = {
                    'free': '免费',
                    'beta': '内测',
                    'basic': '基础',
                    'pro': '专业',
                    'plus': '高级'
                };
                return tierMap[item.user_tier] || item.user_tier;
            });
            
            const data = tierData.map(item => item.count);
            
            new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: [
                            '#4F46E5',
                            '#7C3AED',
                            '#10B981',
                            '#F59E0B',
                            '#EF4444'
                        ],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right'
                        }
                    }
                }
            });
        }
        
        function updateFeatureUsageChart(featureData) {
            const ctx = document.getElementById('featureUsageChart').getContext('2d');
            
            const labels = featureData.map(item => item.feature);
            const data = featureData.map(item => item.count);
            
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: '使用次数',
                        data: data,
                        backgroundColor: '#4F46E5',
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }
        
        function loadRecentActivity() {
            fetch('/api/admin/logs?limit=5', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Authorization': 'Bearer ' + localStorage.getItem('admin_token')
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const logs = data.data.logs;
                    const activityLog = document.getElementById('activityLog');
                    
                    if (logs.length > 0) {
                        activityLog.innerHTML = '';
                        
                        logs.forEach(log => {
                            const row = document.createElement('tr');
                            row.innerHTML = `
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    ${new Date(log.created_at).toLocaleString()}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    ${log.email || '未知用户'}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    ${log.feature}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${log.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                                        ${log.status === 'success' ? '成功' : '失败'}
                                    </span>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    ${log.error_message ? log.error_message.substring(0, 50) + '...' : '无'}
                                </td>
                            `;
                            activityLog.appendChild(row);
                        });
                    } else {
                        activityLog.innerHTML = `
                            <tr>
                                <td colspan="5" class="px-6 py-10 text-center text-gray-500">
                                    暂无活动记录
                                </td>
                            </tr>
                        `;
                    }
                }
            })
            .catch(error => {
                console.error('加载最近活动失败:', error);
                document.getElementById('activityLog').innerHTML = `
                    <tr>
                        <td colspan="5" class="px-6 py-10 text-center text-gray-500">
                            加载失败
                        </td>
                    </tr>
                `;
            });
        }
    </script>
</body>
</html>