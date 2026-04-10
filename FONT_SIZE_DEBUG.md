# 字体大小调试指南

## 问题：字体大小切换没有效果

### 调试步骤

1. **打开浏览器开发者工具**
   - 按 F12 或右键 → 检查

2. **检查 CSS 变量**
   - 在 Console 中输入：
   ```javascript
   getComputedStyle(document.documentElement).getPropertyValue('--base-font-size')
   ```
   - 应该显示当前字体大小（如 "14px"）

3. **检查 body 的字体大小**
   - 在 Console 中输入：
   ```javascript
   getComputedStyle(document.body).fontSize
   ```
   - 应该显示实际应用的字体大小

4. **手动测试字体大小**
   - 在 Console 中输入：
   ```javascript
   document.documentElement.style.setProperty('--base-font-size', '20px')
   ```
   - 观察页面文字是否变大

5. **检查设置是否保存**
   - 在 Console 中输入：
   ```javascript
   localStorage.getItem('architect-user-prefs-v130')
   ```
   - 查看 fontSize 字段的值

## 测试页面

打开 `test-font-size.html` 进行独立测试：
```bash
# 在浏览器中打开
file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI）/test-font-size.html
```

这个测试页面可以验证：
- CSS 变量是否正常工作
- 字体大小是否能动态改变
- 不同字号的视觉效果

## 可能的原因

### 1. Tailwind CSS 覆盖
Tailwind 的 utility classes 可能覆盖了 body 的字体大小。

**解决方案：**
- 使用 `!important` 强制应用
- 或者在所有文本元素上使用 `font-size: inherit`

### 2. 固定字号的 Tailwind 类
如果元素使用了 `text-sm`、`text-base`、`text-lg` 等类，会覆盖继承的字体大小。

**解决方案：**
- 移除固定字号的类
- 或者使用相对单位（em、rem）

### 3. 组件内部的固定字号
某些组件可能在 style 属性中设置了固定字号。

**解决方案：**
- 检查并移除固定字号
- 使用 CSS 变量或继承

## 修复方案

### 方案 1：使用 !important（已实施）
```css
body {
  font-size: var(--base-font-size, 14px) !important;
}
```

### 方案 2：全局继承
```css
p, span, div, button, input, textarea, label, a {
  font-size: inherit;
}
```

### 方案 3：使用 rem 单位
将所有固定像素值改为 rem：
```css
:root {
  font-size: var(--base-font-size, 14px);
}

body {
  font-size: 1rem; /* 相对于 root */
}

.text-small {
  font-size: 0.875rem; /* 相对于 root */
}
```

## 验证修复

1. **重新构建**
   ```bash
   npm run build
   ```

2. **清除缓存**
   - 按 Ctrl+Shift+R 强制刷新
   - 或清除浏览器缓存

3. **测试字号切换**
   - 打开设置 → 界面偏好
   - 点击"小"、"标准"、"大"
   - 观察页面文字大小变化

4. **检查 Console**
   - 查看是否有 CSS 错误
   - 查看字体大小是否正确设置

## 预期效果

切换字号后：
- **小号 (12px)**：文字明显变小
- **标准 (14px)**：默认大小
- **大号 (16px)**：文字明显变大

如果仍然没有效果，请提供：
1. 浏览器 Console 的输出
2. 开发者工具中 body 元素的 Computed 样式
3. localStorage 中的 preferences 值
