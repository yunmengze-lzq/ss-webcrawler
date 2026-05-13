# RPA 流程优化方案

本方案基于 `web-crawler-学习案例` 的实现方式整理，适配当前 `ts-agent`。核心结论：先不要急着写数据库和固定接口，先把 RPA 做成“任务化采集 + 文件样例沉淀 + 字段确认 + 解析入库”的流水线。

## 一、从案例学到的关键模式

### 1. 主进程只做调度，不写业务细节

案例的主进程负责：

- 创建主窗口和业务子窗口；
- 按业务域注入 token；
- 给子窗口 preload 发送 `exportExcel` 事件；
- 等 preload 完成后关闭窗口；
- 把成功/失败结果返回给前端。

当前项目应该保持这个方向：`electron/index.ts` 不应该塞具体页面点击逻辑，只保留 `createSubWindow`、下载捕获、任务派发、超时关闭、日志记录。

### 2. 每类业务数据一套独立任务

案例里每张表基本都有：

```text
electron/preload/<业务名>/index.ts     负责打开页面、点按钮、设置条件、下载文件
src/forms/<业务名>/index.vue           负责用户输入参数、点击导出、显示结果
src/forms/<业务名>/dealExcel.ts        负责解析 Excel、生成结果表
```

当前项目可以对应成：

```text
load_meter  计量负载率
gis         GIS 台区坐标
asset       资产台账
marketing   营销报装
voltage     电压事件
```

每个任务单独维护页面 URL、查询条件、按钮策略、下载/接口策略、解析规则，避免把所有系统揉成一个大爬虫。

### 3. 内网系统常见真实路径是“点击导出 Excel”

案例里很多脚本不是直接调后端 API，而是：

- 等 iframe 加载；
- 进入 iframe 的 `contentWindow`；
- 调用页面自带 jQuery / ECP 控件对象；
- 点击查询方案；
- 修改页面控件值；
- 点击查询；
- 等表格有数据；
- 点击导出；
- 拦截系统自带下载函数；
- 用 `fetch(url)` 下载文件；
- 保存为本地 Excel。

这说明当前项目的第一阶段不应强行填 `LIST_URL`，而应先确认每个系统是否支持导出按钮、是否在 iframe 内、是否有异步导出任务。

### 4. 参数要持久化，防止刷新后丢状态

案例用 `storage/<任务名>参数storage.json` 保存任务参数，页面刷新后还能继续执行。当前项目也应保存：

- 上次查询条件；
- 任务模式：发现 / 文件导出 / 接口 JSON；
- 下载目录；
- 已确认字段映射；
- 最近成功样例。

### 5. Excel 解析应该用流式读取

案例大量使用：

```ts
new ExcelJS.stream.xlsx.WorkbookReader(filePath, {})
```

这比一次性读 workbook 更适合内网大表。当前项目后续解析负载率、低电压、营销报装 Excel，也应优先用 `exceljs` 流式读，不要引入 Python `openpyxl`。

## 二、建议的新 RPA 流程

### 阶段 0：环境确认

目标：确认程序能跑，不做业务采集。

- Node 必须为 `v24.14.1`；
- 不执行 `npm install` / `pip install`；
- `npm run build` 只做离线编译；
- 不启用 SQLite；
- 不启用定时任务。

交付物：

- `dist/`
- `dist-electron/`
- 环境检查截图或日志。

### 阶段 1：发现模式

目标：弄清楚数据从哪里来。

每个系统都跑一遍发现模式，记录：

- 目标页面 URL；
- 是否有 iframe；
- 查询按钮选择器；
- 导出按钮选择器；
- 下载文件类型；
- 是否需要查询方案；
- 是否有分页；
- 是否能直接抓接口；
- 是否异步导出，需要轮询任务列表。

输出物：

```text
docs/rpa-samples/<system>/
  page-snapshot.json
  request-log.json
  sample.xlsx 或 sample.pdf
  notes.md
```

### 阶段 2：半自动导出模式

目标：用户输入条件，程序自动点页面并下载文件。

每个任务建立一份配置：

```ts
{
  system: 'load_meter',
  name: '计量负载率',
  domain: 'finance',
  url: '真实页面 URL',
  mode: 'download',
  frameSelector: '#mainFrame',
  queryButton: '#doQueryBtn',
  exportButton: '#doExportBtn',
  confirmButton: '#ok1',
  waitTableSelector: '.ui-jqgrid-btable td',
  minCellCount: 20,
}
```

preload 执行顺序：

1. 等页面 ready；
2. 找 iframe；
3. 设置查询条件；
4. 点查询；
5. 等表格数据；
6. 点导出；
7. 捕获下载；
8. 返回文件路径。

### 阶段 3：样例解析模式

目标：只解析真实样例，不碰数据库。

每类文件先写 `parse_<system>.ts` 或 `dealExcel.ts`，输出统一 JSON：

```ts
{
  system: 'load_meter',
  sourceFile: 'xxx.xlsx',
  rows: [
    {
      ts_id: '台区编号',
      record_date: '2026-05-01',
      load_rate_max: 82.3,
      load_kw_max: 120.5
    }
  ],
  warnings: []
}
```

字段不确定时只输出 `warnings`，不要写库。

### 阶段 4：入库模式

满足以下条件才启用 SQLite：

- 至少有 1 份真实样例；
- 字段名、单位、主键、日期粒度确认；
- 重复采集的覆盖/追加策略确认；
- 异常样例确认；
- 业务人员确认解析结果。

启用：

```powershell
$env:TS_AGENT_ENABLE_LOCAL_DB='1'
```

### 阶段 5：定时模式

只有半自动稳定后再启用：

```powershell
$env:TS_AGENT_ENABLE_SCHEDULE='1'
```

定时任务必须先检查：

- token 是否有效；
- 上次任务是否完成；
- 下载目录是否可写；
- 失败是否需要人工介入。

## 三、当前项目应优先改造的点

### P0：先做任务登记，不做数据库

新增 `docs/rpa-task-register.json`，登记每个系统当前状态：

```json
[
  {
    "system": "load_meter",
    "name": "计量负载率",
    "status": "discovery",
    "dataSource": "unknown",
    "sampleFile": "",
    "confirmedFields": false
  }
]
```

### P0：发现模式输出文件

当前发现模式已经能返回页面快照，但应进一步落盘：

```text
rpa-discovery/<system>/<timestamp>/
  snapshot.json
  requests.json
  downloads.json
```

### P0：下载优先于接口

对未知系统，不要要求填写 `LIST_URL`。先尝试：

1. 页面表格；
2. 导出按钮；
3. 下载文件；
4. 再考虑接口 JSON。

### P1：为每个系统做参数面板

主界面应该从“5 个按钮”升级为任务面板：

- 查询月份；
- 查询范围；
- 是否自动点击导出；
- 下载关键词；
- iframe 选择器；
- 最近样例；
- 解析状态。

### P1：建立 Excel 解析模板

每个系统都按这个骨架写：

```ts
import ExcelJS from 'exceljs'

export async function parseLoadMeter(filePath: string) {
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {})
  const rows = []
  for await (const worksheet of reader) {
    let headerMap: Record<string, number> = {}
    for await (const row of worksheet) {
      if (row.number === 1) {
        row.values.forEach((value, index) => {
          if (value) headerMap[String(value).trim()] = index
        })
        continue
      }
      rows.push({
        ts_id: row.values[headerMap['台区编号']],
        record_date: row.values[headerMap['日期']],
        load_rate_max: Number(row.values[headerMap['最大负载率']] ?? 0),
      })
    }
  }
  return rows
}
```

### P2：稳定后再考虑接口模式

如果发现接口清晰，再把任务模式改为：

```text
download -> api
```

但接口模式仍要保存原始响应，避免字段变化时无法追溯。

## 四、现场操作 SOP

### 第一天：只做发现

1. 登录；
2. 每个系统手动查一次；
3. 触发发现模式；
4. 保存样例文件；
5. 登记字段和按钮路径。

### 第二天：做半自动导出

1. 为 1 个最容易的系统写专用 preload；
2. 自动设置查询条件；
3. 自动导出 Excel；
4. 保存文件；
5. 人工打开 Excel 核对。

### 第三天：做解析

1. 根据真实 Excel 表头写解析器；
2. 输出 JSON；
3. 人工核对 10 条；
4. 再考虑入库。

### 第四天以后：扩展到其他系统

按同样模板复制，不要一开始追求全系统自动化。

## 五、不要做的事

- 不要在内网下载依赖；
- 不要在样例未确认前建库；
- 不要把 token 写死进代码；
- 不要假设所有系统都有接口；
- 不要只靠固定延时，应尽量用“元素出现 / 表格有数据 / 下载完成”判断；
- 不要把 Excel 解析和页面点击写在同一个大文件里。

## 六、推荐的当前落地顺序

1. `load_meter`：先跑发现模式，争取拿到负载率 Excel；
2. `voltage`：确认是否能导出低电压事件；
3. `asset`：确认资产台账能否导出；
4. `gis`：确认坐标字段和坐标系；
5. `marketing`：最后做，因为报装状态和字段通常最不稳定。

先让一个系统完整跑通“打开页面 -> 下载 Excel -> 解析 JSON -> 人工核对”，再复制到其他系统。
