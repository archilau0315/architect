
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { Provider } from 'react-redux';
// [构建修复] 全局样式从独立文件导入，解决 Vite 6 内联 CSS 构建失败问题
import './src/styles/global.css';
import { store } from './src/store';
import './index.css';

const checkAdminResetPassword = () => {
  const pathname = window.location.pathname;
  const search = window.location.search;
  
  if (pathname === '/admin/reset-password' || pathname === '/admin/reset-password.html') {
    // [修复] 增加端口 3000 判定（注：dev 跳转到本机后端 3001 的 admin 静态页，需本机运行后端）
    const apiDomain = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.port === '3000'
      ? 'http://localhost:3001'
      : 'https://api.kbitai.com.cn';
    
    const redirectUrl = `${apiDomain}/admin/reset-password.html${search}`;
    window.location.href = redirectUrl;
    return true;
  }
  return false;
};

if (checkAdminResetPassword()) {
  console.log('Redirecting to admin reset password page');
} else {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error("Could not find root element to mount to");
  }

  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <Provider store={store}>
      <App />
    </Provider>
  );
}
