---
name: fix-video-generator-ui-3issues
overview: 修复视频生成器右侧窗口3个UI问题：(1)等待生成状态摄像机图标与圆圈重叠；(2)生成中状态UI杂乱（三图案+文字）；(3)水印下载失败但无水印可正常下载
todos:
  - id: fix-waiting-state
    content: 修复右侧窗口"等待生成"状态：确认虚线框方案已生效，补齐亮色模式CSS适配
    status: completed
  - id: fix-generating-ui
    content: 优化生成中状态UI：去除冗余旋转圆圈，合并状态+百分比单行，重构为紧凑进度卡片
    status: completed
  - id: fix-watermark-download
    content: 优化水印下载失败体验：去掉error alert，改静默降级下载原视频
    status: completed
  - id: build-and-verify
    content: npm run build 构建验证零错误，重新生成文件清单
    status: completed
    dependencies:
      - fix-waiting-state
      - fix-generating-ui
      - fix-watermark-download
---

## Product Overview

修复视频生成器（VideoGenerator）右侧预览窗口的 3 个 UI/UX 问题。

## Core Features

### 问题1：右侧窗口"等待生成"状态 -- 摄像机图标与旋转圆圈重叠

- **现象**：右侧空白区域显示一个巨大的摄像机 SVG 图标（w-24 h-24），上面叠加一个旋转圆圈（w-12 h-12），两者视觉上重叠冲突，亮暗模式均存在
- **根因**：第1114-1118行（旧代码）同时渲染了大图标和旋转圈，是冗余的装饰性重复
- **当前状态**：上一轮已改为虚线框+小图标方案（第1113-1121行），但用户截图可能反映的是部署前的旧版本。需确认代码已正确更新并重新构建部署

### 问题2：生成中状态UI杂乱 -- 多元素堆叠

- **现象**：视频生成过程中，右侧窗口显示5个元素纵向堆叠：旋转大圆圈(w-16) → 状态文字("正在计算光影...") → 进度条(w-48) → 百分比文字("50%") → 取消按钮。视觉层次不清、元素过多
- **根因**：第1009-1026行的布局缺乏层次设计，所有元素平铺排列且间距不统一
- **优化方向**：
- 去掉独立的大旋转圆圈（进度条本身已传达"进行中"含义）
- 将状态文字+百分比合并为一行（如 "正在计算光影... 50%"）
- 进度条作为唯一核心视觉焦点
- 取消按钮保持底部但样式精简
- 整体采用紧凑卡片式布局

### 问题3：水印下载失败提示体验差

- **现象**：视频生成成功后点击"带水印下载"，弹出alert "水印处理失败，将下载原视频"，但实际文件能正常下载（fallback到无水印原始videoUrl）
- **根因**：`videoWatermarkService.ts` 使用 FFmpeg WASM (从 unpkg CDN 加载)，在以下情况会失败：网络不通/CORS/WASM加载超时/浏览器兼容性。`handleDownload` 第678行catch块弹窗报错但继续执行fallback下载
- **问题本质**：用户体验差 —— 先看到一个"失败"提示，然后文件却下载成功了，自相矛盾
- **修复方向**：
- 水印处理失败时不应该弹error alert（因为不是致命错误）
- 改为静默降级：水印不可用时直接下载原视频，用toast或按钮状态文字温和告知用户
- 或更优方案：既然用户说"可以下无水印"，说明水印功能对标准下载非必须，应简化流程

## Tech Stack

- React 18 + TypeScript + Tailwind CSS v4
- 自定义 `.light-mode` CSS 类机制（非 tailwind `light:` 前缀）
- FFmpeg WASM (@ffmpeg/ffmpeg) 用于水印处理

## Implementation Approach

### 问题1：等待生成状态（已在上轮修改，需验证构建）

- 已将大摄像机SVG(w-24)+旋转圆圈的重复结构替换为虚线边框容器(w-20 h-20 rounded-2xl border-dashed)内嵌小摄像机图标(w-8)
- 需确认当前代码状态无误后构建

### 问题2：生成中状态UI重设计

采用"单焦点进度卡片"模式：

```
┌─────────────────────────────┐
│                             │
│    [小型摄像机图标 w-10]     │
│                             │
│   正在计算光影...    50%     │  ← 状态+百分比合并一行
│   ████████████░░░░░         │  ← 进度条(唯一焦点)
│                             │
│        [ ✕ 取消生成 ]        │  ← 精简按钮
└─────────────────────────────┘
```

关键改动：

- 删除独立的 w-16 大旋转圆圈（与进度条语义重复）
- 状态文字和百分比合并为 flex justify-between 单行
- 进度条加宽至 w-56 并使用渐变色增强视觉焦点
- 整体 padding 收紧，去掉 mb-6/mt-2/mt-4 等松散间距
- 背景模糊层保留但降低透明度

### 问题3：水印下载失败体验优化

改动 `handleDownload` 函数中 else 分支（标准下载，第632-688行）：

- catch块不再弹 window.alert('水印处理失败...')
- 改为：静默降级直接下载原videoUrl + console.warn记录错误
- 在下载按钮区域用状态文字温和提示（如 isWatermarkProcessing 配合文字变化）
- 如果 watermarkedVideoUrl 为 null（之前生成时已失败），跳过水印步骤直接用原视频下载

## Architecture Design

仅涉及 `components/VideoGenerator.tsx` 单文件的3处UI区域修改，不影响数据流、组件通信或API调用。

## Agent Extensions

- **ui-ux-pro-max**
- Purpose: 提供生成中状态的 UI/UX 设计规范指导（进度反馈、加载状态、微交互最佳实践）
- Expected outcome: 确保优化后的生成中状态符合现代 UI 标准——单一视觉焦点、清晰的进度传达、优雅的降级体验