# Daily Assistant

这是一套只在 Bruce 这台 Mac 上运行的 React + FastAPI 个人操作系统。唯一主页是：

```text
http://127.0.0.1:8766/
```

页面包括：

- `/`：Calendar、Notion、本周计划、快捷入口和待办。
- `/life`：只在本机保存的生活事项、时间线、Someday 和完成历史；不与 Calendar/Notion 同步。
- `/learn`：全栈 + Agentic AI 大图、5 条学习路线、Daily/Pi Web Codebase Gym、freeCodeCamp JavaScript V9、TypeScript 和项目级 Python 训练。
- `/agent`：以独立源 iframe 嵌入本机 Pi Web，提供 Pi Agent 的 sessions、models、skills、tools 和项目文件工作区。
- `/neetcode`：NeetCode 150 Roadmap、Do Now、solution/心得和多次 attempts 历史。
- `/applications`：自动岗位队列、申请 CRM、follow-up/deadline 和只读 Gmail Inbox Copilot。
- `/life`：本地生活时间线，以及带按日行程和内置 Google Maps 视图的当前旅行计划。
- `/discover`：只读湾区活动和新闻雷达。
- `/python`：181 项 Python 参考卡片、中文知识目录，以及无需 API 的本地智能搜索；支持自然语言、近似拼写、单卡聚焦、最近查看和按分类分页。

## 启动

```bash
uv sync
cd frontend && npm install && npm run build && cd ..
./bin/run_v2_dev.sh
```

`run_v2_dev.sh` 会先在 `127.0.0.1:30141` 启动固定版本的
`@agegr/pi-web@0.8.1` sidecar（端口已被使用时不会重复启动），再把
`data/daily_v2.db` 无损升级到最新 schema，并启动 8766。Pi Web 的运行日志写入
`pi-web.log` 和 `pi-web.err`。

Agent Module 保持两个进程、两个 origin：Daily 只通过
`/api/v1/pi-web/status` 检查 sidecar 是否可用，不反向代理 Pi Web API，也不直接
控制 agent。iframe 只开放剪贴板能力；Pi Web 仍负责自己的 session、工具权限和文件访问。
如需覆盖默认端口，可在启动前设置 `PI_WEB_PORT`，并让后端的 `PI_WEB_URL` 指向相同地址。

## 每天 09:00

`~/Library/LaunchAgents/com.bruce.daily-dashboard.plist` 调用：

```bash
./bin/run_daily.sh
```

它运行 `bin/refresh_dashboard.py`，原子更新 `data/dashboard_snapshot.json`；如果 Gmail 已授权，还会做一次只读招聘邮件扫描，最后打开 8766。Gmail 扫描失败不会阻止主页刷新。它不再生成 `today.html`，也不会启动旧 8765 服务。

岗位刷新会保留每个匹配岗位的首次发现时间。当天首次发现且尚未提醒的岗位会由 `bin/notify_new_jobs.py` 发送一次 macOS 通知；同一天重复刷新不会重复提醒。Apply 页面同时提供 FAANG 和主要科技公司的官方 careers 直达入口，提醒数据仍明确来自公开聚合岗位源，不声称覆盖各公司官网全部职位。

单独刷新、不重建 Calendar 事件提醒：

```bash
./bin/refresh_dashboard.py --no-reminders
```

## Daily Snapshot

Snapshot Module 对 Calendar、Notion、Brave Search、Job Feeds 分别保留 last-known-good 数据。某个源失败时，页面继续显示上一次成功结果，并在 `stale_sources` 中标记；验证失败的 payload 不会覆盖当前文件。`refresh_job_feeds.py` 也通过同一个 Module 写入。

环境变量：

```bash
export DASHBOARD_HOME="$HOME/daily-dashboard"
export DASHBOARD_TIMEZONE="America/Los_Angeles"
export NOTION_PAGE_ID="35ea5189545c80cfa8c3c910e0265817"
export NOTION_LINKS_PAGE_ID="c56dc8e916e74f7aa2b2c04482452dd2"
```

数据源：Google Calendar (`gcalcli`)、Notion (`NOTION_API_TOKEN`)、Brave Search (`BRAVE_API_KEY`) 和公开 Job Feeds。

## Gmail Inbox Copilot

Gmail 侧只读。邮件会先变成 `Application Signal`，显示建议阶段、下一步和识别到的 deadline；只有点 `CONFIRM & UPDATE CRM` 后才写本地 `daily_v2.db`。`DISMISS` 不创建、不修改申请。系统不会发送、归档、删信或改 Gmail 标签，也不会把完整邮件正文存进数据库。

本机使用 Google Desktop OAuth 和 Gmail REST API。首次配置：

```bash
# 将 Desktop App 凭据保存为 data/google-oauth-client.json，然后运行：
./bin/connect_gmail.py
```

授权后 token 保存在 `data/gmail-token.json`，两个文件都被 Git 忽略且权限为 `600`。每天 09:00 的 `run_daily.sh` 会调用 `bin/sync_gmail.py`，页面显示 `AUTO SYNC`。分类完全在本机进行，不产生模型/API 费用；数据库只保存审核建议所需的邮件元数据，不保存完整正文。

要断开连接，可在 Google Account 的第三方访问设置中撤销授权，并删除本机 `data/gmail-token.json`。未配置本地 OAuth 时，Codex Gmail bridge 仍可作为手动后备入口。

## 数据与迁移

本地私有数据不会提交 Git：

- `data/daily_v2.db`：唯一可写数据库。
- `data/dashboard_snapshot.json`：可重建的只读 Snapshot。
- `data/google-oauth-client.json` 和 `data/gmail-token.json`：本机 Gmail OAuth 凭据，永不提交 Git。
- `data/candidate_profile.json` 和简历原文件：本地候选人信息。
- `data/backups/legacy-dashboard-retired-20260717.db`：退休旧版时保留的只读迁移备份。

重复安全地导入旧刷题历史：

```bash
.venv/bin/python bin/migrate_v2.py
```

迁移前会备份到 `data/backups/`。旧版 `today.html`、8765 server 和专用样式已退休并从项目移除；备份数据库只用于历史数据恢复，不会被正常运行写入。

## 验证

```bash
.venv/bin/pytest backend/tests -q
python3 -m unittest discover -s tests -v
cd frontend && npm test -- --run && npm run build
```

架构词汇和边界见 `CONTEXT.md`，关键决策见 `docs/adr/`。
