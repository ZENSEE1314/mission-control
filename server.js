/**
 * Ruflo Mission Control — Enhanced Backend Server v2
 * REST + WebSocket API wrapping ruflo/claude-flow + openclaw CLI
 * Run:  node server.js
 * Open: http://localhost:3847
 */

import express from 'express';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import os from 'os';
import https from 'https';

const execAsync = promisify(exec);
const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const PORT       = process.env.PORT || 3847;

// ── Paths ─────────────────────────────────────────────────────────────────────
const TASKS_DIR    = path.join(__dirname, 'tasks');
const SKILLS_DIR   = path.join(__dirname, 'skills');
const SETTINGS_FILE= path.join(__dirname, 'settings.json');
const RUFLO_CMD    = 'npx claude-flow';
const CLAW_CMD     = 'npx openclaw';

[TASKS_DIR, SKILLS_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }));

// ── Default settings ──────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  apiKeys: { anthropic:'', openai:'', github:'', openrouter:'', gemini:'' },
  social: {
    discord: { webhook:'', botToken:'', channelId:'' },
    twitter: { apiKey:'', apiSecret:'', bearerToken:'', accessToken:'' },
    linkedin: { accessToken:'' },
    slack: { webhook:'', botToken:'', channel:'' },
  },
  openclaw: { enabled:true, targetVersion:'2026.3.22', autoUpdate:true },
  ruflo: { topology:'hierarchical', maxAgents:8 },
  general: { timezone:'Asia/Kuala_Lumpur', port:3847, taskOutputFolder: TASKS_DIR },
};

function loadSettings() {
  if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2));
    return { ...DEFAULT_SETTINGS };
  }
  try { return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')); }
  catch { return { ...DEFAULT_SETTINGS }; }
}

function saveSettings(data) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2));
}

// ── Curated Skill Store ───────────────────────────────────────────────────────
const SKILL_STORE = [
  { id:'web-researcher', name:'Web Researcher', description:'Searches the web, summarises sources and returns structured research notes.', tags:['research','web'], version:'1.2', author:'ruvnet', downloads:4820 },
  { id:'code-reviewer',  name:'Code Reviewer',  description:'Reviews pull requests for bugs, security issues, and code quality.', tags:['dev','quality'], version:'2.0', author:'ruvnet', downloads:3210 },
  { id:'content-writer', name:'Content Writer', description:'Generates blog posts, social captions, and community content from bullet points.', tags:['content','social'], version:'1.5', author:'community', downloads:2980 },
  { id:'data-analyst',   name:'Data Analyst',   description:'Reads CSV/Excel data and produces insights, charts suggestions, and summaries.', tags:['data','analytics'], version:'1.1', author:'ruvnet', downloads:1760 },
  { id:'api-builder',    name:'API Builder',     description:'Scaffolds REST APIs with Express, FastAPI or Hono from a plain-English spec.', tags:['dev','api'], version:'3.0', author:'ruvnet', downloads:5500 },
  { id:'seo-optimizer',  name:'SEO Optimizer',   description:'Audits pages, rewrites meta tags, and builds keyword strategies.', tags:['seo','content'], version:'1.0', author:'community', downloads:890 },
  { id:'email-drafter',  name:'Email Drafter',   description:'Drafts professional emails, cold outreach, and follow-ups from a brief.', tags:['comms'], version:'1.3', author:'ruvnet', downloads:2100 },
  { id:'test-writer',    name:'Test Writer',     description:'Generates unit, integration, and e2e tests from source code.', tags:['dev','testing'], version:'2.1', author:'ruvnet', downloads:3800 },
  { id:'social-poster',  name:'Social Poster',   description:'Publishes content to Discord, Twitter/X, LinkedIn via configured API keys.', tags:['social','automation'], version:'1.0', author:'community', downloads:1240 },
  { id:'scheduler',      name:'Task Scheduler',  description:'Schedules recurring ruflo tasks and sends digest emails/notifications.', tags:['automation'], version:'1.4', author:'ruvnet', downloads:2670 },
  { id:'memory-manager', name:'Memory Manager',  description:'Organises ruflo vector memory, prunes stale entries, exports backups.', tags:['memory','admin'], version:'1.0', author:'ruvnet', downloads:990 },
  { id:'docs-writer',    name:'Docs Writer',     description:'Generates README, API docs, and wiki pages from code or brief.', tags:['docs','dev'], version:'1.7', author:'ruvnet', downloads:4100 },
];

// ── App + WS ──────────────────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);
const wss    = new WebSocketServer({ server });
const clients= new Set();

app.use(cors());
app.use(express.json({ limit:'10mb' }));
app.use(express.static(__dirname));

wss.on('connection', ws => {
  clients.add(ws);
  ws.send(JSON.stringify({ type:'connected', message:'🌊 Mission Control online' }));
  ws.on('close', () => clients.delete(ws));
});

function broadcast(payload) {
  const msg = JSON.stringify(payload);
  for (const ws of clients) if (ws.readyState === 1) ws.send(msg);
}

// ── CLI helper ────────────────────────────────────────────────────────────────
async function run(cmd, opts = {}) {
  try {
    const settings = loadSettings();
    const env = {
      ...process.env,
      ANTHROPIC_API_KEY: settings.apiKeys?.anthropic || '',
      OPENAI_API_KEY:    settings.apiKeys?.openai    || '',
      GITHUB_TOKEN:      settings.apiKeys?.github    || '',
    };
    const { stdout, stderr } = await execAsync(cmd, { cwd: __dirname, timeout:30_000, env, ...opts });
    return { ok:true, output:stdout.trim(), error:stderr.trim() };
  } catch(e) {
    return { ok:false, output:'', error:e.message };
  }
}

function createTaskFolder(label) {
  const today = new Date().toISOString().slice(0,10);
  const time  = new Date().toTimeString().slice(0,8).replace(/:/g,'-');
  const safe  = label.replace(/[^a-z0-9]+/gi,'-').slice(0,40).toLowerCase();
  const folder= path.join(TASKS_DIR, today, `${time}_${safe}`);
  fs.mkdirSync(folder, { recursive:true });
  return { folder, today };
}

// ════════════════════════════════════════════════════════════════════════════
// SETTINGS
// ════════════════════════════════════════════════════════════════════════════
app.get('/api/settings', (req,res) => res.json(loadSettings()));

app.post('/api/settings', (req,res) => {
  const current = loadSettings();
  const merged  = deepMerge(current, req.body);
  saveSettings(merged);
  broadcast({ type:'settings_saved' });
  res.json({ ok:true });
});

function deepMerge(base, override) {
  const out = { ...base };
  for (const [k,v] of Object.entries(override || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = deepMerge(base[k] || {}, v);
    } else { out[k] = v; }
  }
  return out;
}

// ════════════════════════════════════════════════════════════════════════════
// AGENTS / BOTS
// ════════════════════════════════════════════════════════════════════════════
app.get('/api/agents', async (req,res) => {
  const r = await run(`${RUFLO_CMD} agent list`);
  res.json({ ok:r.ok, raw:r.output, error:r.error });
});

app.post('/api/agents/spawn', async (req,res) => {
  const { type='coder', name } = req.body;
  const n = name || `${type}-${Date.now()}`;
  const r = await run(`${RUFLO_CMD} agent spawn --type ${type} --name ${n}`);
  broadcast({ type:'agent_spawned', agentName:n, agentType:type, output:r.output });
  res.json({ ok:r.ok, agentName:n, raw:r.output });
});

app.delete('/api/agents/:id', async (req,res) => {
  const r = await run(`${RUFLO_CMD} agent stop ${req.params.id}`);
  broadcast({ type:'agent_stopped', agentId:req.params.id });
  res.json({ ok:r.ok, raw:r.output });
});

app.get('/api/agents/:id/logs', async (req,res) => {
  const r = await run(`${RUFLO_CMD} agent logs ${req.params.id}`);
  res.json({ ok:r.ok, raw:r.output });
});

// AI-generated agent config (markdown) from a short prompt
app.post('/api/agents/generate', async (req,res) => {
  const { prompt, type='coder' } = req.body;
  if (!prompt) return res.status(400).json({ error:'prompt required' });

  const template = generateAgentMD(prompt, type);
  res.json({ ok:true, markdown:template });
});

// Create bot from generated markdown
app.post('/api/agents/create-from-md', async (req,res) => {
  const { name, type, markdown } = req.body;
  const skillPath = path.join(SKILLS_DIR, `agent-${name.replace(/\s+/g,'-').toLowerCase()}.md`);
  fs.writeFileSync(skillPath, markdown);
  const r = await run(`${RUFLO_CMD} agent spawn --type ${type} --name "${name}" --config "${skillPath}"`);
  broadcast({ type:'agent_created', name, agentType:type });
  res.json({ ok:r.ok, raw:r.output, skillPath });
});

function generateAgentMD(prompt, type) {
  const name = prompt.slice(0,40).replace(/[^a-z0-9 ]/gi,'').trim();
  return `# ${name} Agent

## Role
${type.charAt(0).toUpperCase()+type.slice(1)} agent specialised in: ${prompt}

## Objective
${prompt}

## Capabilities
- Analyse requirements and break down tasks
- Execute autonomously with minimal human intervention
- Report progress and results clearly
- Collaborate with other agents in the swarm

## Instructions
1. Read the task brief carefully
2. Plan approach before executing
3. Use available tools and memory
4. Save all outputs to the task folder
5. Report completion with summary

## Output Format
- Summary of what was done
- Key findings or deliverables
- Any blockers or follow-up tasks

## Notes
Generated by Ruflo Mission Control AI Studio
Type: ${type}
Created: ${new Date().toISOString()}
`;
}

// ════════════════════════════════════════════════════════════════════════════
// SWARM
// ════════════════════════════════════════════════════════════════════════════
app.post('/api/swarm/init',   async (req,res) => {
  const { topology='hierarchical', maxAgents=8 } = req.body;
  const r = await run(`${RUFLO_CMD} swarm init --topology ${topology} --max-agents ${maxAgents}`);
  broadcast({ type:'swarm_init', topology, maxAgents });
  res.json({ ok:r.ok, raw:r.output });
});

app.get('/api/swarm/status',  async (req,res) => {
  const r = await run(`${RUFLO_CMD} swarm status`);
  res.json({ ok:r.ok, raw:r.output });
});

app.post('/api/swarm/stop',   async (req,res) => {
  const r = await run(`${RUFLO_CMD} swarm stop`);
  broadcast({ type:'swarm_stopped' });
  res.json({ ok:r.ok, raw:r.output });
});

// Full dispatch: init → spawn → start → task
app.post('/api/dispatch', async (req,res) => {
  const { objective, topology='hierarchical' } = req.body;
  if (!objective) return res.status(400).json({ error:'objective required' });

  const { folder, today } = createTaskFolder(objective);
  const log = [];
  const go = async cmd => {
    const r = await run(cmd);
    log.push(`$ ${cmd}\n${r.output}${r.error?'\nERR: '+r.error:''}`);
    broadcast({ type:'log', message:`$ ${cmd.split(' ').slice(-3).join(' ')}`, output:r.output });
    return r;
  };

  await go(`${RUFLO_CMD} swarm init --topology ${topology} --max-agents 8`);
  for (const ag of [['coordinator','lead'],['coder','coder-1'],['researcher','researcher-1'],['reviewer','reviewer-1']]) {
    await go(`${RUFLO_CMD} agent spawn --type ${ag[0]} --name ${ag[1]}`);
  }
  await go(`${RUFLO_CMD} swarm start --objective "${objective.replace(/"/g,'\\"')}" --strategy development`);
  await go(`${RUFLO_CMD} task create --type implementation --description "${objective.replace(/"/g,'\\"')}"`);

  const logText = `OBJECTIVE: ${objective}\nDATE: ${new Date().toISOString()}\n\n${log.join('\n\n')}`;
  fs.writeFileSync(path.join(folder,'dispatch.log'), logText);
  fs.writeFileSync(path.join(folder,'objective.txt'), objective);

  broadcast({ type:'dispatch_complete', objective, folder, date:today, timestamp:new Date().toISOString() });
  res.json({ ok:true, folder, log:log.join('\n\n') });
});

// ════════════════════════════════════════════════════════════════════════════
// TASKS
// ════════════════════════════════════════════════════════════════════════════
app.get('/api/tasks',         async (req,res) => { const r=await run(`${RUFLO_CMD} task list --all`);  res.json({ ok:r.ok, raw:r.output, error:r.error }); });
app.get('/api/tasks/:id',     async (req,res) => { const r=await run(`${RUFLO_CMD} task status ${req.params.id}`); res.json({ ok:r.ok, raw:r.output }); });
app.delete('/api/tasks/:id',  async (req,res) => { const r=await run(`${RUFLO_CMD} task cancel ${req.params.id}`); broadcast({ type:'task_cancelled',taskId:req.params.id }); res.json({ ok:r.ok, raw:r.output }); });

// ════════════════════════════════════════════════════════════════════════════
// MEMORY
// ════════════════════════════════════════════════════════════════════════════
app.get('/api/memory', async (req,res) => {
  const r = await run(`${RUFLO_CMD} memory list ${req.query.namespace?'--namespace '+req.query.namespace:''}`);
  res.json({ ok:r.ok, raw:r.output });
});

// ════════════════════════════════════════════════════════════════════════════
// SKILLS
// ════════════════════════════════════════════════════════════════════════════
app.get('/api/skills/store', (req,res) => {
  const installed = getInstalledSkillIds();
  res.json(SKILL_STORE.map(s => ({ ...s, installed: installed.includes(s.id) })));
});

app.get('/api/skills/local', (req,res) => {
  if (!fs.existsSync(SKILLS_DIR)) return res.json([]);
  const files = fs.readdirSync(SKILLS_DIR).filter(f => f.endsWith('.md') || f.endsWith('.json'));
  const skills = files.map(f => {
    const full = path.join(SKILLS_DIR, f);
    const content = fs.readFileSync(full,'utf8');
    const titleMatch = content.match(/^#\s+(.+)/m);
    return { id:f.replace(/\.(md|json)$/,''), name:titleMatch?titleMatch[1]:f, filename:f, content, size:content.length };
  });
  res.json(skills);
});

app.post('/api/skills/upload', (req,res) => {
  const { name, content } = req.body;
  if (!name || !content) return res.status(400).json({ error:'name and content required' });
  const filename = `${name.replace(/[^a-z0-9-]/gi,'-').toLowerCase()}.md`;
  fs.writeFileSync(path.join(SKILLS_DIR,filename), content);
  broadcast({ type:'skill_uploaded', name, filename });
  res.json({ ok:true, filename });
});

app.post('/api/skills/install', async (req,res) => {
  const { id } = req.body;
  const skill = SKILL_STORE.find(s => s.id === id);
  if (!skill) return res.status(404).json({ error:'Skill not found in store' });

  const content = generateSkillMD(skill);
  const filename = `${id}.md`;
  fs.writeFileSync(path.join(SKILLS_DIR,filename), content);

  // Try openclaw skill install too
  await run(`${CLAW_CMD} skills install ${id}`).catch(()=>{});

  broadcast({ type:'skill_installed', id, name:skill.name });
  res.json({ ok:true, filename });
});

app.delete('/api/skills/:id', (req,res) => {
  const { id } = req.params;
  const candidates = [path.join(SKILLS_DIR,`${id}.md`), path.join(SKILLS_DIR,`${id}.json`)];
  let deleted = false;
  for (const f of candidates) { if (fs.existsSync(f)) { fs.unlinkSync(f); deleted=true; } }
  if (!deleted) return res.status(404).json({ error:'Skill file not found' });
  broadcast({ type:'skill_deleted', id });
  res.json({ ok:true });
});

function getInstalledSkillIds() {
  if (!fs.existsSync(SKILLS_DIR)) return [];
  return fs.readdirSync(SKILLS_DIR)
    .filter(f=>f.endsWith('.md')||f.endsWith('.json'))
    .map(f=>f.replace(/\.(md|json)$/,''));
}

function generateSkillMD({ id, name, description, tags, author, version }) {
  return `# ${name}

## Description
${description}

## Tags
${tags.join(', ')}

## Author
${author}

## Version
${version}

## Instructions
This skill was installed from the Ruflo Skill Store.
Configure it in your agent definitions by referencing this file.

## Metadata
id: ${id}
installed: ${new Date().toISOString()}
`;
}

// ════════════════════════════════════════════════════════════════════════════
// CALENDAR
// ════════════════════════════════════════════════════════════════════════════
app.get('/api/calendar', (req,res) => {
  const events = [];

  // Read from tasks folder (completed runs)
  if (fs.existsSync(TASKS_DIR)) {
    for (const date of fs.readdirSync(TASKS_DIR)) {
      const dateDir = path.join(TASKS_DIR,date);
      if (!fs.statSync(dateDir).isDirectory()) continue;
      for (const task of fs.readdirSync(dateDir)) {
        const taskDir = path.join(dateDir,task);
        const objFile = path.join(taskDir,'objective.txt');
        const logFile = path.join(taskDir,'dispatch.log');
        const objective = fs.existsSync(objFile) ? fs.readFileSync(objFile,'utf8').trim() : task;
        const hasLog    = fs.existsSync(logFile);
        const timeParts = task.split('_')[0].replace(/-/g,':');
        events.push({ date, time:timeParts, title:objective.slice(0,60), type:'completed', folder:task });
      }
    }
  }

  // Simulated upcoming (from schedules or ruflo task list)
  events.sort((a,b)=>b.date.localeCompare(a.date));
  res.json({ events });
});

// Add a manual calendar event
app.post('/api/calendar/event', (req,res) => {
  const { date, time, title, type='scheduled' } = req.body;
  const calFile = path.join(__dirname,'calendar.json');
  const existing = fs.existsSync(calFile) ? JSON.parse(fs.readFileSync(calFile,'utf8')) : [];
  existing.push({ date, time, title, type, id:Date.now() });
  fs.writeFileSync(calFile, JSON.stringify(existing,null,2));
  res.json({ ok:true });
});

// ════════════════════════════════════════════════════════════════════════════
// OPENCLAW
// ════════════════════════════════════════════════════════════════════════════
app.get('/api/openclaw/status', async (req,res) => {
  const r = await run('npx openclaw --version');
  const installed = r.ok && r.output.trim().length > 0;
  const version   = r.output.trim() || 'not installed';
  res.json({ installed, version, latest:'2026.3.22' });
});

app.post('/api/openclaw/install', async (req,res) => {
  broadcast({ type:'log', message:'Installing OpenClaw…', output:'' });
  const settings = loadSettings();
  const target   = settings.openclaw?.targetVersion || '2026.3.22';

  // Check current version first
  const check = await run('npx openclaw --version');
  if (check.ok && check.output.includes(target)) {
    return res.json({ ok:true, message:`OpenClaw ${target} already installed`, skipped:true });
  }

  // Install target version
  const r = await run(`npm install -g openclaw@${target}`);
  broadcast({ type:'openclaw_installed', version:target, ok:r.ok });
  res.json({ ok:r.ok, raw:r.output, error:r.error, version:target });
});

app.post('/api/openclaw/update', async (req,res) => {
  const r = await run('npm install -g openclaw@latest');
  broadcast({ type:'openclaw_updated', ok:r.ok });
  res.json({ ok:r.ok, raw:r.output });
});

// OpenClaw skill operations (via openclaw CLI)
app.get('/api/openclaw/skills', async (req,res) => {
  const r = await run(`${CLAW_CMD} skills list`);
  res.json({ ok:r.ok, raw:r.output });
});

// ════════════════════════════════════════════════════════════════════════════
// AI STUDIO — Generate markdown from short prompt
// ════════════════════════════════════════════════════════════════════════════
app.post('/api/ai/generate-md', async (req,res) => {
  const { prompt, type='agent' } = req.body;
  if (!prompt) return res.status(400).json({ error:'prompt required' });

  const templates = {
    agent:    generateAgentMD(prompt, 'coder'),
    skill:    generateSkillMD({ id:prompt.slice(0,20).replace(/\s/g,'-').toLowerCase(), name:prompt, description:prompt, tags:['custom'], author:'zen', version:'1.0' }),
    workflow: generateWorkflowMD(prompt),
    readme:   generateReadmeMD(prompt),
  };
  const md = templates[type] || templates.agent;
  res.json({ ok:true, markdown:md, type });
});

function generateWorkflowMD(prompt) {
  return `# Workflow: ${prompt}

## Overview
${prompt}

## Steps
1. Initialise swarm with coordinator, coder, and reviewer agents
2. Coordinator breaks down the objective into sub-tasks
3. Coder implements each sub-task autonomously
4. Reviewer validates output for quality and correctness
5. Coordinator compiles final result and saves to output folder

## Triggers
- Manual dispatch via Mission Control
- Scheduled (configure in Calendar)
- API call to /api/dispatch

## Output
Saved to: tasks/{date}/{timestamp}_workflow/

## Created
${new Date().toISOString()}
`;
}

function generateReadmeMD(prompt) {
  return `# ${prompt}

## Overview
${prompt}

## Installation
\`\`\`bash
npm install
\`\`\`

## Usage
\`\`\`bash
npm start
\`\`\`

## Features
- Feature 1
- Feature 2
- Feature 3

## Configuration
Edit \`settings.json\` to configure API keys and preferences.

## License
MIT
`;
}

// ════════════════════════════════════════════════════════════════════════════
// TASK OUTPUT FOLDERS
// ════════════════════════════════════════════════════════════════════════════
app.get('/api/folders', (req,res) => {
  const dates = [];
  if (!fs.existsSync(TASKS_DIR)) return res.json({ dates });
  for (const date of fs.readdirSync(TASKS_DIR).sort().reverse()) {
    const dateDir = path.join(TASKS_DIR,date);
    if (!fs.statSync(dateDir).isDirectory()) continue;
    const tasks = fs.readdirSync(dateDir).map(t => {
      const tp = path.join(dateDir,t);
      const files = fs.readdirSync(tp);
      const objFile = path.join(tp,'objective.txt');
      return { name:t, files, objective: fs.existsSync(objFile)?fs.readFileSync(objFile,'utf8').trim():'' };
    });
    dates.push({ date, tasks });
  }
  res.json({ dates });
});

app.get('/api/folders/:date/:task/:file', (req,res) => {
  const fp = path.join(TASKS_DIR,req.params.date,req.params.task,req.params.file);
  if (!fs.existsSync(fp)) return res.status(404).json({ error:'Not found' });
  res.sendFile(fp);
});

// ── Status + Health ───────────────────────────────────────────────────────────
app.get('/api/status', async (req,res) => {
  const [swarm,agents] = await Promise.all([run(`${RUFLO_CMD} status`),run(`${RUFLO_CMD} agent list`)]);
  res.json({ swarm:swarm.output, agents:agents.output, timestamp:new Date().toISOString() });
});
app.get('/health', (_,res) => res.json({ status:'ok', port:PORT, uptime:process.uptime() }));

// ── Boot ──────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════════════════╗`);
  console.log(`║  🌊  Ruflo Mission Control v2 — Running           ║`);
  console.log(`║  http://localhost:${PORT}                         ║`);
  console.log(`╚══════════════════════════════════════════════════╝\n`);
});
