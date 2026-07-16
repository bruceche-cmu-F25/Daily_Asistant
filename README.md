# Daily Dashboard

每天从 Google Calendar、Notion 和 Brave Search 汇总信息，生成本地页面 `today.html`。页面顶部的教练模式只负责算法刷题：每次推荐一道具体题，并提供完成标准和卡住时的帮助路径。

## React + FastAPI v2 preview

`codex/react-fastapi-refactor` 分支正在以只读方式并行开发新版，本地端口为 `8766`；旧版 `8765` 和现有 SQLite 数据不会被修改。

```bash
uv sync
cd frontend && npm install && npm run build && cd ..
./bin/run_v2_dev.sh
```

然后打开：

```text
http://127.0.0.1:8766/
```

新版当前包含 `/`、`/neetcode`、`/discover` 三条路由，并只读显示现有 NeetCode 150 与旧版刷题记录。后端测试使用 `.venv/bin/pytest`，前端检查使用 `npm run typecheck`、`npm test` 和 `npm run build`。

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

默认运行 `todo` 时，页面会通过仅监听 `127.0.0.1` 的本地服务打开：

```text
http://127.0.0.1:8765/today.html
```

只有具体算法题的进度保存在本机 SQLite：

```text
data/dashboard.db
```

Calendar 和 Notion checklist 仍只保存在浏览器 `localStorage`：

```text
todo:<calendar-event-id>
todo:notion:<notion-block-id>
```

勾选不会回写 Notion，也不会写入 SQLite。SQLite 只记录题目名称、链接、Topic、完成时间、卡住次数、你的 solution 与心得。数据库和浏览器状态都不会提交到 Git。

## 教练模式

- 题库维护在 `data/problem_bank.json`，当前是完整的 NeetCode 150（18 个 Topic）。
- 需要更新官方题单时运行 `./bin/sync_neetcode150.py`；脚本只有在解析到恰好 150 题时才会覆盖本地题库。
- 选择当前可用的 `15 / 30 / 45 / 60` 分钟。
- 页面只突出一个具体 NeetCode 150 题目，并直接打开 NeetCode 题目页。
- `不会做 / 卡住了` 会展开分层帮助，并增加这道题的卡住次数。
- `完成并写心得` 会让你保存 solution 和心得，写入 SQLite 后自动切换到下一题。
- `换一题` 保留当前题目，轮换到另一个未完成题目。
- 顶部 `History` 会跳到本地刷题历史：显示总进度、各 Topic 进度和每题笔记。

## 视觉主题

Retro shader 主题分别维护在：

- `assets/dashboard-retro.css`：布局、CRT、响应式与高对比面板。
- `assets/dashboard-retro.js`：安全的交互、实时状态时钟、教练与刷题历史渲染。

外链会根据域名自动获得 favicon、字母 fallback 和品牌强调色；新增链接通常不需要手工添加图标。

生成时这两个文件会被内联进 `today.html`。系统开启“减少动态效果”时，会关闭剩余的轻量动画。

## 自动运行

`~/Library/LaunchAgents/com.bruce.daily-dashboard.plist` 每天调用 `bin/run_daily.sh`。生成器会先写临时文件，再原子替换 `today.html`，避免中断时留下不完整页面。

页面顶部会显示 Calendar、Notion、Brave Search 三个数据源的生成状态。`pi-web.log` 和 `pi-web.err` 是旧版本遗留文件，当前流程不再启动 pi-web。
