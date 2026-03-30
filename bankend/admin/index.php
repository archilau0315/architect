<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>管理员登录 - 首席图像架构师</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/font-awesome@4.7.0/css/font-awesome.min.css" rel="stylesheet">
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        primary: '#4F46E5',
                        secondary: '#7C3AED',
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
            .shadow-login {
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            }
        }
    </style>
</head>
<body class="bg-gray-50 min-h-screen flex items-center justify-center font-inter">
    <div class="w-full max-w-md p-8">
        <div class="bg-white rounded-2xl shadow-login p-8 space-y-6">
            <div class="text-center">
                <div class="w-16 h-16 mx-auto bg-gradient-primary rounded-full flex items-center justify-center mb-6">
                    <i class="fa fa-shield text-white text-2xl"></i>
                </div>
                <h1 class="text-2xl font-bold text-gray-900">管理员登录</h1>
                <p class="text-gray-500 mt-2">请输入管理员账号和密码</p>
            </div>
            
            <form id="loginForm" class="space-y-4">
                <div>
                    <label for="username" class="block text-sm font-medium text-gray-700 mb-1">用户名</label>
                    <div class="relative">
                        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <i class="fa fa-user text-gray-400"></i>
                        </div>
                        <input type="text" id="username" name="username" required
                            class="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                            placeholder="请输入用户名">
                    </div>
                </div>
                
                <div>
                    <label for="password" class="block text-sm font-medium text-gray-700 mb-1">密码</label>
                    <div class="relative">
                        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <i class="fa fa-lock text-gray-400"></i>
                        </div>
                        <input type="password" id="password" name="password" required
                            class="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                            placeholder="请输入密码">
                        <button type="button" id="togglePassword" class="absolute inset-y-0 right-0 pr-3 flex items-center">
                            <i class="fa fa-eye text-gray-400"></i>
                        </button>
                    </div>
                </div>
                
                <div class="flex items-center justify-between">
                    <div class="flex items-center">
                        <input id="remember" name="remember" type="checkbox"
                            class="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded">
                        <label for="remember" class="ml-2 block text-sm text-gray-700">
                            记住我
                        </label>
                    </div>
                    <a href="#" class="text-sm text-primary hover:text-secondary transition-colors">
                        忘记密码？
                    </a>
                </div>
                
                <button type="submit" id="loginButton"
                    class="w-full bg-gradient-primary text-white py-3 px-4 rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center justify-center space-x-2">
                    <i class="fa fa-sign-in"></i>
                    <span>登录</span>
                </button>
            </form>
        </div>
        
        <div class="text-center mt-6 text-sm text-gray-500">
            <p>© 2026 首席图像架构师 - 管理员后台</p>
        </div>
    </div>
    
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            // 切换密码可见性
            const togglePassword = document.getElementById('togglePassword');
            const password = document.getElementById('password');
            
            togglePassword.addEventListener('click', function() {
                const type = password.getAttribute('type') === 'password' ? 'text' : 'password';
                password.setAttribute('type', type);
                this.querySelector('i').className = type === 'password' ? 'fa fa-eye text-gray-400' : 'fa fa-eye-slash text-gray-400';
            });
            
            // 登录表单提交
            const loginForm = document.getElementById('loginForm');
            const loginButton = document.getElementById('loginButton');
            
            loginForm.addEventListener('submit', function(e) {
                e.preventDefault();
                
                const username = document.getElementById('username').value;
                const password = document.getElementById('password').value;
                
                loginButton.disabled = true;
                loginButton.innerHTML = '<i class="fa fa-spinner fa-spin"></i><span>登录中...</span>';
                
                // 调用登录API
                fetch('/api/admin/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: JSON.stringify({
                        username: username,
                        password: password
                    })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        // 登录成功，保存token并跳转到仪表盘
                        localStorage.setItem('admin_token', data.data.token);
                        localStorage.setItem('admin_user', JSON.stringify(data.data.admin));
                        window.location.href = 'dashboard.php';
                    } else {
                        // 登录失败
                        alert(data.error || '登录失败，请检查用户名和密码');
                        loginButton.disabled = false;
                        loginButton.innerHTML = '<i class="fa fa-sign-in"></i><span>登录</span>';
                    }
                })
                .catch(error => {
                    console.error('登录错误:', error);
                    alert('网络错误，请稍后重试');
                    loginButton.disabled = false;
                    loginButton.innerHTML = '<i class="fa fa-sign-in"></i><span>登录</span>';
                });
            });
        });
    </script>
</body>
</html>