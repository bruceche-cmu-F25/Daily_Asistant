# Replicate Bruce's Pi Agent Setup on Another Mac

> Legacy setup notes. The current dashboard no longer starts pi-web and calls the Brave Search API directly. See `README.md` for the active workflow.

This doc tells another pi agent how to reproduce the setup I built on Bruce's Mac: Notion access, Brave Search, Google Calendar, Daily Dashboard, `todo` terminal command, pi-web startup, and the dashboard link system.

> Do **not** paste secrets into chat unless Bruce explicitly approves. Use local env vars and private config files.

---

## 0. What this setup does

The `todo` command:

1. Starts pi web UI if it is not already running:
   ```bash
   npx -y @agegr/pi-web@latest
   ```
2. Reads today's Google Calendar via `gcalcli`.
3. Reads Notion pages via Notion REST API.
4. Uses Brave Search API to fetch:
   - tech news
   - SDE / intern / new grad job openings
5. Generates and opens:
   ```bash
   ~/daily-dashboard/today.html
   ```
6. Schedules launchd event openers for upcoming calendar events that day.

---

## 1. Required tools

Install Homebrew packages:

```bash
brew install gcalcli node
```

Optional but useful:

```bash
brew install jq
```

---

## 2. Shell environment variables

Add these to `~/.zprofile` and/or `~/.zshrc`:

```bash
# Brave Search API
export BRAVE_API_KEY="YOUR_BRAVE_API_KEY"

# Notion API
export NOTION_API_TOKEN="YOUR_NOTION_INTERNAL_CONNECTION_TOKEN"

# Daily dashboard shortcut
TODO() {
  /Users/bruce/daily-dashboard/bin/run_daily.sh
}
```

On another Mac, replace `/Users/bruce` with that user's home directory or use `$HOME` when rewriting scripts.

Also install a real command in PATH, so both `todo` and `TODO` work even if shell functions do not load:

```bash
cat > /opt/homebrew/bin/todo <<'SH'
#!/bin/zsh
source ~/.zprofile 2>/dev/null
$HOME/daily-dashboard/bin/run_daily.sh
SH
chmod +x /opt/homebrew/bin/todo
cp /opt/homebrew/bin/todo /opt/homebrew/bin/TODO
```

---

## 3. Brave Search skill

Existing skill location on Bruce's Mac:

```bash
~/.pi/agent/skills/brave-search
```

Install dependencies once:

```bash
cd ~/.pi/agent/skills/brave-search
npm install
```

Test:

```bash
source ~/.zprofile
~/.pi/agent/skills/brave-search/search.js "Brave Search API" -n 1
```

Expected: one search result.

---

## 4. Notion API setup

Use a Notion internal connection / access token.

### In Notion

1. Go to Notion integrations / connections.
2. Create an **Access token** connection, not OAuth.
3. Enable capabilities:
   - Read content
   - Insert content
   - Update content
   - Read comments / insert comments if desired
4. Copy the token into:
   ```bash
   export NOTION_API_TOKEN="ntn_..."
   ```
5. Share the relevant pages/databases with the connection.

### Required Notion pages used by dashboard

Bruce's current IDs:

```text
Main page: 变得更强
ID: 35ea5189545c80cfa8c3c910e0265817

Links to Visit
ID: c56dc8e9-16e7-4f7a-a2b2-c04482452dd2
```

If using a different workspace, update these constants in:

```bash
~/daily-dashboard/bin/generate_dashboard.py
```

```python
NOTION_PAGE_ID = '...'
LINKS_PAGE_ID = '...'
```

Test Notion auth:

```bash
source ~/.zprofile
curl -s "https://api.notion.com/v1/users/me" \
  -H "Authorization: Bearer $NOTION_API_TOKEN" \
  -H "Notion-Version: 2025-09-03" | jq
```

Test page access:

```bash
PAGE_ID="35ea5189545c80cfa8c3c910e0265817"
curl -s "https://api.notion.com/v1/pages/$PAGE_ID" \
  -H "Authorization: Bearer $NOTION_API_TOKEN" \
  -H "Notion-Version: 2025-09-03" | jq
```

If you get `object_not_found`, the page is not shared with the Notion connection.

---

## 5. Google Calendar via gcalcli

### Install

```bash
brew install gcalcli
```

### Google Cloud setup

1. Go to Google Cloud Console.
2. Enable **Google Calendar API**.
3. Create OAuth Client ID:
   - Application type: **Desktop app**
4. If app is in testing, add the Google account as a **Test user**.
5. Authenticate:

```bash
gcalcli --client-id "YOUR_CLIENT_ID.apps.googleusercontent.com" \
  --client-secret "YOUR_CLIENT_SECRET" \
  --noauth_local_server list
```

Open the URL, approve Calendar access, then test:

```bash
gcalcli list
gcalcli agenda today tomorrow --nocolor
```

---

## 6. Daily Dashboard files

Create this directory structure:

```bash
mkdir -p ~/daily-dashboard/bin ~/daily-dashboard/event-plists ~/Library/LaunchAgents
```

Copy from Bruce's Mac if possible:

```bash
~/daily-dashboard/bin/generate_dashboard.py
~/daily-dashboard/bin/open_event.py
~/daily-dashboard/bin/run_daily.sh
~/Library/LaunchAgents/com.bruce.daily-dashboard.plist
```

If moving to another username, replace hardcoded `/Users/bruce` paths with the new home path.

Important files:

```text
~/daily-dashboard/bin/generate_dashboard.py  # builds today.html
~/daily-dashboard/bin/open_event.py          # opens dashboard + event URL
~/daily-dashboard/bin/run_daily.sh           # starts pi-web, runs generator
~/daily-dashboard/today.html                 # generated output
~/daily-dashboard/event-plists/              # temporary launchd event openers
```

---

## 7. run_daily.sh behavior

Use this structure:

```bash
#!/bin/zsh
# launchd starts with a tiny PATH, so set Homebrew paths explicitly.
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/opt/local/bin:/opt/local/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
source ~/.zprofile 2>/dev/null
source ~/.zshrc 2>/dev/null

# Start pi web UI once, in the background. pi-web listens on 30141.
if ! lsof -tiTCP:30141 -sTCP:LISTEN >/dev/null 2>&1 && ! pgrep -f "@agegr/pi-web|node .*pi-web" >/dev/null 2>&1; then
  nohup zsh -lc 'cd $HOME && npx -y @agegr/pi-web@latest' >> $HOME/daily-dashboard/pi-web.log 2>> $HOME/daily-dashboard/pi-web.err &
fi

$HOME/daily-dashboard/bin/generate_dashboard.py >> $HOME/daily-dashboard/run.log 2>> $HOME/daily-dashboard/run.err
```

Why explicit PATH matters: launchd does not inherit your interactive shell PATH. Without `/opt/homebrew/bin`, Brave Search may fail because `node` is missing.

---

## 8. launchd daily 9 AM automation

Create:

```bash
~/Library/LaunchAgents/com.bruce.daily-dashboard.plist
```

Template:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.bruce.daily-dashboard</string>
  <key>ProgramArguments</key>
  <array>
    <string>/Users/bruce/daily-dashboard/bin/run_daily.sh</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key><integer>9</integer>
    <key>Minute</key><integer>0</integer>
  </dict>
  <key>RunAtLoad</key>
  <false/>
  <key>StandardOutPath</key>
  <string>/Users/bruce/daily-dashboard/launchd.out</string>
  <key>StandardErrorPath</key>
  <string>/Users/bruce/daily-dashboard/launchd.err</string>
</dict>
</plist>
```

Load it:

```bash
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.bruce.daily-dashboard.plist 2>/dev/null || true
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.bruce.daily-dashboard.plist
```

Check status:

```bash
launchctl print gui/$(id -u)/com.bruce.daily-dashboard | head -80
```

---

## 9. Current dashboard sections

The dashboard currently renders:

1. Hero priority summary
2. Calendar → Todo
3. Notion Plan / current week plan
4. Study links
5. Job Hunt links grouped by:
   - Daily first
   - Curated lists
   - Platforms
   - Profile & prep
6. Fresh-ish openings scan via Brave
7. Tech news via Brave
8. Lower priority links color-coded by function:
   - Jobs
   - Study
   - Infra/App
   - Billing
   - Ideas
   - Profile
   - Research
9. Right sidebar Start Here buttons:
   - LeetCode
   - freeCodeCamp
   - JobRight
   - This Week
   - DSA Video
   - Harvard Web

---

## 10. Important links currently embedded

Main quick links:

```text
LeetCode: https://leetcode.com/problemset/
freeCodeCamp: https://www.freecodecamp.org/learn/
JobRight: https://jobright.ai/jobs/recommend
Abdul Bari DSA: https://www.youtube.com/playlist?list=PLDN4rrl48XKpZkf03iYFl-O29szjTrs_O
Harvard CS50W: https://www.youtube.com/playlist?list=PLhQjrBD2T380xvFSUmToMMzERZ3qB5Ueu
```

Study repos added:

```text
30 Days Of Python: https://github.com/Asabeneh/30-Days-Of-Python
Project Based Learning: https://github.com/practical-tutorials/project-based-learning
Build Your Own X: https://github.com/codecrafters-io/build-your-own-x
Microsoft ML For Beginners: https://github.com/microsoft/ML-For-Beginners
500 AI/ML/DL/CV/NLP Projects: https://github.com/ashishpatel26/500-AI-Machine-learning-Deep-learning-Computer-vision-NLP-Projects-with-code
```

Lower priority links include:

```text
ElevenLabs billing
Inworld TTS billing
IdeaBrowser ideas
TrustMRR search
Handshake job
LinkedIn profile
GitHub profile
The Odin Project
Render deploys
Cloudflare R2
NightyNight app
Neon SQL editor
Boson Higgs Audio v2.5
f.inc
```

---

## 11. Troubleshooting

### Brave results empty at 9 AM but work manually

Cause: launchd PATH missing Homebrew `node`.

Fix: ensure `run_daily.sh` contains:

```bash
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
```

### Notion returns object_not_found

The page is not shared with the Notion connection. Open the page in Notion → Share/Add connections → add the integration.

### gcalcli not authenticated

Run:

```bash
gcalcli list
```

If prompted for client ID/secret, redo OAuth.

### pi-web port already in use

This is usually OK. The script checks port `30141` and avoids starting another copy.

---

## 12. Safe operating rules for the other agent

- Do not print full API tokens back to the user.
- Before destructive Notion/Calendar edits, ask for confirmation.
- For Google Calendar event creation, confirm date/time/title unless the user clearly asks to add it immediately.
- For Notion checklist additions, appending non-destructive todo blocks is usually OK if the target page is clear.
- Never expose sensitive API keys found in Notion pages.
