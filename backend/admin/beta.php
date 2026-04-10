<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>内测申请 - 管理员后台</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/font-awesome@4.7.0/css/font-awesome.min.css" rel="stylesheet">
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
                <a href="dashboard.php" class="flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors">
                    <i class="fa fa-dashboard w-5 text-center"></i>
                    <span>仪表盘</span>
                </a>
                <a href="users.php" class="flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors">
                    <i class="fa fa-users w-5 text-center"></i>
                    <span>用户管理</span>
                </a>
                <a href="beta.php" class="flex items-center space-x-3 px-4 py-3 rounded-lg bg-gray-800 text-white">
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
                        <h2 class="text-lg font-semibold text-gray-900">内测申请</h2>
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
                <div class="bg-white rounded-xl card-shadow p-6 mb-6">
                    <h3 class="text-lg font-semibold text-gray-900 mb-4">内测申请管理</h3>
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead>
                                <tr>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">邮箱</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">申请时间</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200" id="betaList">
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
            
            // 加载内测申请
            loadBetaRequests();
        });
        
        function loadBetaRequests() {
            fetch('/api/admin/beta-requests', {
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
                    updateBetaList(data.data.requests);
                }
            })
            .catch(error => {
                console.error('加载内测申请失败:', error);
            });
        }
        
        function updateBetaList(requests) {
            const betaList = document.getElementById('betaList');
            
            if (requests.length > 0) {
                betaList.innerHTML = '';
                
                requests.forEach(request => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${request.id}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${request.email}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${new Date(request.applied_at).toLocaleString()}</td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}">
                                ${request.status === 'pending' ? '待处理' : '已处理'}
                            </span>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            ${request.status === 'pending' ? `
                                <button onclick="approveBeta(${request.id})" class="text-success hover:text-green-700 mr-3">
                                    <i class="fa fa-check"></i> 批准
                                </button>
                                <button onclick="rejectBeta(${request.id})" class="text-danger hover:text-red-700">
                                    <i class="fa fa-times"></i> 拒绝
                                </button>
                            ` : `
                                <span class="text-gray-500">已处理</span>
                            `}
                        </td>
                    `;
                    betaList.appendChild(row);
                });
            } else {
                betaList.innerHTML = `
                    <tr>
                        <td colspan="5" class="px-6 py-10 text-center text-gray-500">
                            暂无内测申请
                        </td>
                    </tr>
                `;
            }
        }
        
        function approveBeta(id) {
            if (confirm('确定要批准这个内测申请吗？')) {
                fetch(`/api/admin/beta-requests/${id}/approve`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                        'Authorization': 'Bearer ' + localStorage.getItem('admin_token')
                    }
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        alert('批准成功');
                        loadBetaRequests();
                    } else {
                        alert('批准失败: ' + data.message);
                    }
                })
                .catch(error => {
                    console.error('批准失败:', error);
                    alert('批准失败');
                });
            }
        }
        
        function rejectBeta(id) {
            if (confirm('确定要拒绝这个内测申请吗？')) {
                fetch(`/api/admin/beta-requests/${id}/reject`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                        'Authorization': 'Bearer ' + localStorage.getItem('admin_token')
                    }
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        alert('拒绝成功');
                        loadBetaRequests();
                    } else {
                        alert('拒绝失败: ' + data.message);
                    }
                })
                .catch(error => {
                    console.error('拒绝失败:', error);
                    alert('拒绝失败');
                });
            }
        }
    </script>
</body>
</html>
