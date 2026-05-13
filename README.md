# ss-webcrawler

内网接口取数与智能体数据源管理工具。

## 核心流程

1. 从浏览器 `F12 -> Network -> Fetch/XHR` 复制接口 URL、Headers/Cookie、Payload。
2. 在接口管理台保存为可复用接口。
3. 配置运行时载荷字段、自动翻页规则、响应列表路径和字段映射。
4. 每次运行先保存原始 JSON，再生成标准 `rows.json`，最后按配置写入 Excel、SQLite 或两者。

## 离线构建

```powershell
node scripts\build-offline.mjs
```

默认只编译前端和 Electron 主进程，跳过 `electron-builder`，避免内网下载构建依赖。

## UI 预览

```powershell
npx vite --config vite.ui.mjs --host 127.0.0.1 --port 5178 --strictPort
```

浏览器预览模式只用于查看界面和保存本地示例配置；真实接口请求、Cookie 辅助更新、Excel/SQLite 写入需要 Electron 版。

## 内网运行

内网电脑解压离线包后，双击：

```text
启动-智能体取数工具.bat
```

详见 `内网离线运行说明.md`。不要在内网执行 `npm install` 或下载任何依赖。
