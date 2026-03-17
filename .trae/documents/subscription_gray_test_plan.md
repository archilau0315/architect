# 订阅计费灰度测试方案

## 需求
ICP许可证尚未办理，当用户点击设置中的"订阅计费"标签时，不显示完整的订阅界面，改为显示"灰度测试中"提示。

## 修改文件
`components/SettingsPanel.tsx`

## 实现方案

### 修改位置
`renderSubscription()` 函数（约第235行）

### 修改内容
在 `renderSubscription()` 函数开头添加灰度测试提示界面，直接返回提示内容，不显示原有的订阅方案。

### 界面设计
- 显示"功能灰度测试中"标题
- 说明文字：ICP备案办理中，订阅计费功能即将上线
- 显示预计上线时间或联系方式
- 保持与现有设置面板风格一致

### 代码修改

```tsx
const renderSubscription = () => {
  // 灰度测试提示界面
  return (
    <div className="flex flex-col items-center justify-center py-20 space-y-8 animate-in fade-in duration-500">
      <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
        <svg className="w-12 h-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div className="text-center space-y-4">
        <h3 className="text-2xl font-black italic text-slate-700 dark:text-slate-200">功能灰度测试中</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
          ICP备案办理中，订阅计费功能即将上线。敬请期待！
        </p>
        <div className="pt-4">
          <span className="px-6 py-2 bg-slate-100 dark:bg-slate-800 rounded-full text-xs font-black text-slate-400 uppercase tracking-widest">
            Coming Soon
          </span>
        </div>
      </div>
    </div>
  );
  
  // 以下原有代码保留但不执行...
};
```

### 保留原有代码
- 不删除任何订阅相关的代码
- 只是在函数开头提前返回灰度测试提示
- 原有订阅方案、计费周期、积分加油包等代码完整保留

## 优点
1. 代码不丢失，方便后续恢复
2. 实现简单，只需修改一处
3. 用户界面友好，明确告知功能即将上线
