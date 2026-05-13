# 内网 RPA 操作清单

## 不能做

- 不在内网执行 `npm install`、`pip install`、`pip download`。
- 不在内网临时下载 Electron、Chromium、Playwright、地图瓦片、Python 包或模型文件。
- 不在数据格式未知时创建 SQLite 数据库。
- 不把接口 JSON 作为唯一采集方式；系统可能只能通过按钮导出 Excel/PDF。

## 外网一次性准备

1. Node 版本固定为 `24.14.1`。
2. 外网安装依赖并验证：

```powershell
node -v
npm install
npm run build
```

说明：`npm run build` 已改为 `vite build && electron-builder`，不再默认执行 `vue-tsc --noEmit`。旧版 `vue-tsc` 在 Node 24.14.1 环境可能报 `Search string not found: "/supportedTSExtensions = .*(?=;)/"`，内网不要通过下载升级来修。

3. 打包完整目录，包含：

```text
node_modules/
dist/
dist-electron/
electron/
python/
package.json
README.md
```

4. 记录版本：

```powershell
node -v
npm -v
npm ls --depth=0
```

## 内网验收

```powershell
cd C:\work\ts-agent
node -v
node -e "require('./node_modules/electron-log'); console.log('依赖完整')"
npm run dev
```

要求 `node -v` 输出 `v24.14.1`。如不是该版本，先停下，不要重新安装依赖。

## 数据采集第一阶段：发现模式

目标是确认“数据从哪里来”，不是马上入库。

1. 打开子窗口并登录目标系统。
2. 手动点一次查询，观察页面是否有表格、分页、导出按钮。
3. 触发 RPA：

```javascript
window.ipcApi.crawl('load_meter')
window.ipcApi.crawl('gis')
window.ipcApi.crawl('asset')
window.ipcApi.crawl('marketing')
window.ipcApi.crawl('voltage')
```

4. 未配置真实 URL 时，程序会：

- 监听 `fetch` / `XHR`；
- 采集页面文本、表格和候选按钮；
- 尝试点击“导出 / 下载 / Excel / PDF / 报表 / 明细”按钮；
- 将下载文件保存到 `rpa-downloads/<system>/`。

5. 对每个系统登记：

```text
系统名：
是否有直接接口：
是否必须点按钮导出：
导出文件类型：Excel / PDF / CSV / 其他
是否分页：
查询条件：
台区 ID 字段：
日期字段：
关键指标字段：
样例文件路径：
```

## 数据采集第二阶段：解析模式

拿到样例文件后再决定解析方式：

- Excel：优先用已随 npm 打包的 `exceljs`，不要在内网安装 `openpyxl`。
- PDF：优先确认是否能导出 Excel；必须解析 PDF 时，先在外网准备解析工具，不在内网下载。
- 接口 JSON：确认鉴权、分页、字段路径、增量条件后，再填写各 preload 的 `CONFIG`。

## 数据库启用条件

满足以下条件后才能建库：

- 已确认每类数据的稳定主键；
- 已确认字段类型和单位；
- 已确认覆盖、追加、去重策略；
- 已确认采集失败回滚策略；
- 已有至少一份真实样例文件或真实接口响应。

启用命令：

```powershell
$env:TS_AGENT_ENABLE_LOCAL_DB='1'
python python\db_init.py
```

## 其他问题检查结果

- `@types/node` 已调整到 Node 24 系列。
- 启动默认不建 SQLite，避免内网产生错误结构数据库。
- 定时任务默认关闭，避免未知接口和未知文件格式下自动跑失败任务。
- preload 在 URL 为 `TODO:` 时不再直接 `fetch`，会进入 RPA 发现/导出文件模式。
- 下载文件会被 Electron 捕获并保存，避免依赖浏览器默认下载目录。
