# Daily Dashboard

每天从 Google Calendar、Notion 和 Brave Search 汇总信息，生成本地页面 `today.html`。

## 运行

```bash
todo
# 或者：
"$HOME/daily-dashboard/bin/run_daily.sh"
```

只生成页面、不自动打开，也不重建日历提醒：

```bash
"$HOME/daily-dashboard/bin/generate_dashboard.py" --no-open --no-reminders
```

`./bin/generate_dashboard.py` 只有在当前目录已经是 `~/daily-dashboard` 时才有效。

运行测试：

```bash
PYTHONPYCACHEPREFIX=/tmp/daily-dashboard-pycache \
  python3 -m unittest discover -s tests -v
```

## 数据源

- Google Calendar：通过 `gcalcli` 读取当天日程。
- Notion：通过 `NOTION_API_TOKEN` 读取主页面和链接页面。
- Brave Search：通过 `BRAVE_API_KEY` 直接调用 Web Search API，不依赖 pi agent skill。

默认配置可以用环境变量覆盖：

```bash
export DASHBOARD_HOME="$HOME/daily-dashboard"
export DASHBOARD_TIMEZONE="America/Los_Angeles"
export NOTION_PAGE_ID="35ea5189545c80cfa8c3c910e0265817"
export NOTION_LINKS_PAGE_ID="c56dc8e916e74f7aa2b2c04482452dd2"
```

## Checklist 状态

网页中的 Calendar 和 Notion checklist 都使用稳定 key 保存在浏览器 `localStorage`：

```text
todo:<calendar-event-id>
todo:notion:<notion-block-id>
```

勾选不会回写 Notion。Notion 原始 checked 状态只在浏览器还没有本地记录时作为初始值。

## 视觉主题

Retro shader 主题分别维护在：

- `assets/dashboard-retro.css`：布局、CRT、响应式与高对比面板。
- `assets/dashboard-retro.js`：低对比 WebGL 背景和实时状态时钟。

外链会根据域名自动获得 favicon、字母 fallback 和品牌强调色；新增链接通常不需要手工添加图标。

生成时这两个文件会被内联进 `today.html`，所以最终页面仍然是一个可以直接打开的独立 HTML 文件。系统开启“减少动态效果”时，shader 会切换为静态低功耗画面。

## 自动运行

`~/Library/LaunchAgents/com.bruce.daily-dashboard.plist` 每天调用 `bin/run_daily.sh`。生成器会先写临时文件，再原子替换 `today.html`，避免中断时留下不完整页面。

页面顶部会显示 Calendar、Notion、Brave Search 三个数据源的生成状态。`pi-web.log` 和 `pi-web.err` 是旧版本遗留文件，当前流程不再启动 pi-web。
