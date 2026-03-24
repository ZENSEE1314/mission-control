# 🌊 Ruflo Mission Control v2

Full-stack AI agent orchestration dashboard — desktop app, 24/7 cloud, and Windows installer.

---

## 🚀 Quick Start (3 options)

### Option A — Desktop App (Recommended)
```
Double-click build.bat
→ Generates:  electron/dist/Ruflo Mission Control Setup.exe
→ Share this .exe with anyone — installs everything automatically
```

### Option B — Run Locally (No build needed)
```bash
npm install
node server.js
# Open: http://localhost:3847/dashboard.html
```

### Option C — Deploy to Render (24/7 Cloud)
```
1. Push this folder to GitHub
2. dashboard.render.com → New → Blueprint → connect your repo
3. Render reads render/render.yaml and deploys automatically
4. Set API keys in Render → Environment tab
```

---

## 📁 Folder Structure

```
Ruflo Mission Control/
├── dashboard.html          ← Full multi-tab web dashboard
├── server.js               ← Express + WebSocket backend
├── package.json            ← Node dependencies
├── settings.json           ← API keys, social, config (auto-created)
├── skills/                 ← Your installed skills (.md files)
├── tasks/                  ← Dated task outputs (auto-created per run)
│   └── 2026-03-25/
│       └── 14-30-01_build-api/
│           ├── objective.txt
│           └── dispatch.log
├── electron/
│   ├── main.js             ← Electron desktop wrapper
│   ├── preload.js          ← IPC bridge
│   ├── package.json        ← electron-builder config (generates .exe)
│   ├── installer.nsh       ← Custom NSIS installer logic
│   └── assets/             ← App icons
└── render/
    ├── render.yaml         ← Render.com Blueprint config
    └── Dockerfile          ← Docker container (for Render or self-host)
```

---

## 🖥 Dashboard Tabs

| Tab | What it does |
|-----|-------------|
| **🎛 Command Center** | Agents panel, Tasks, Memory, Activity log, Dated output folders |
| **🤖 Bot Manager** | View/spawn/delete agents + AI Studio (prompt → Markdown config) |
| **📦 Skill Store** | Install skills from the store, upload your own, manage installed skills |
| **📅 Calendar** | See all task runs by date, add scheduled events |
| **⚙️ Settings** | API keys, Discord/Twitter/LinkedIn/Slack, OpenClaw version, timezone |

---

## 🦞 OpenClaw

OpenClaw (`openclaw/openclaw`) is a personal AI assistant with skills, plugins, and social integrations.

- **Target version:** `2026.3.22`
- **Auto-check:** The installer only downloads OpenClaw if it's missing or outdated
- **Update via Settings tab** → OpenClaw section → Install/Update button
- **CLI:** `npx openclaw --version` to check

---

## 📦 Building the Windows Installer

```
Double-click build.bat
```

This will:
1. Check for Node.js (installs if missing)
2. Check for ruflo (installs if missing)
3. Check for OpenClaw `2026.3.22` (installs only if version doesn't match)
4. Install all dependencies
5. Build the `.exe` using electron-builder + NSIS

**Output:**
- `electron/dist/Ruflo Mission Control Setup.exe` — full installer with shortcuts
- `electron/dist/Ruflo-Mission-Control-Portable.exe` — portable, no install needed

---

## ☁️ Render Deployment (24/7)

```yaml
# render/render.yaml sets up:
# - Web service (dashboard + API, always-on)
# - Daily cron to keep OpenClaw updated
```

After deploying, set these env vars in Render dashboard:
```
ANTHROPIC_API_KEY   = sk-ant-...
OPENAI_API_KEY      = sk-...
GITHUB_TOKEN        = ghp_...
DISCORD_WEBHOOK     = https://discord.com/api/webhooks/...
TWITTER_BEARER      = ...
SLACK_WEBHOOK       = https://hooks.slack.com/services/...
```

---

## ⚙️ Settings

Edit `settings.json` directly or use the **Settings tab** in the dashboard.

All API keys are stored locally in `settings.json` — they are never sent anywhere except to the respective service APIs you configure.

---

## 🔧 Troubleshooting

**Build fails with "electron not found"**
→ Run `cd electron && npm install` then retry `build.bat`

**Dashboard shows "Offline"**
→ Make sure `node server.js` is running, then refresh

**OpenClaw install fails**
→ Run `npm install -g openclaw@2026.3.22` manually in a terminal

**Render service spinning down (free tier)**
→ Upgrade to Starter plan ($7/mo) in Render dashboard for always-on

---

*Ruflo Mission Control v2 — Built for Zen's AI Automation Community*
