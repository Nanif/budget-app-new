# Local Development Setup (Windows)

## Architecture

| Service | Port | Description |
|---------|------|-------------|
| API Server | 3001 | Express + Node.js backend, connects to Supabase |
| Frontend | 3000 | React + Vite dev server, proxies `/api` → `localhost:3001` |

---

## Required Environment Variables

### API Server (required)
| Variable | Value |
|----------|-------|
| `PORT` | `3001` |
| `NODE_ENV` | `production` or `development` |
| `SUPABASE_DATABASE_URL` | Your Supabase connection string |

### Frontend (vite.config.local.ts)
No extra env vars needed — port and base path are hardcoded in `vite.config.local.ts`.

> ⚠️ Do NOT run `pnpm --filter budget-app dev` — that uses `vite.config.ts` which requires `PORT` and `BASE_PATH` (Replit-only).
> Use `vite.config.local.ts` instead (see commands below).

---

## Step-by-Step Setup

### 1. Install prerequisites
- [Node.js LTS](https://nodejs.org)
- pnpm: `npm install -g pnpm`

### 2. Clone and install
```bash
git clone https://github.com/Nanif/budget-app-new.git
cd budget-app-new
pnpm install
```

### 3. Create config.bat (Windows only)
Create a file named `config.bat` in the project root:
```bat
@echo off
set "SUPABASE_DATABASE_URL=postgresql://your-connection-string-here"
```

### 4. Build the API server
```bash
pnpm --filter api-server run build
```

### 5. Run the services

**Terminal 1 — API Server:**
```bat
set PORT=3001
set NODE_ENV=production
call config.bat
node artifacts\api-server\dist\index.mjs
```

**Terminal 2 — Frontend:**
```bash
pnpm --filter budget-app exec vite --config vite.config.local.ts
```

### 6. Open the app
Navigate to: http://localhost:3000

---

## One-click startup (Windows)

Double-click `start.bat` — it handles everything automatically.
It opens two CMD windows (one per service) and then opens the browser.

> ⚠️ Both CMD windows must stay open while using the app.

---

## Common Issues

| Problem | Cause | Fix |
|---------|-------|-----|
| `PORT is required` | Running wrong vite config | Use `vite.config.local.ts`, not `vite.config.ts` |
| `BASE_PATH is required` | Same as above | Use `vite.config.local.ts` |
| API returns 502 | API server not running | Start API on port 3001 first |
| `config.bat not found` | Missing config file | Create `config.bat` with your Supabase URL |
| `pnpm not found` | pnpm not installed | Run `npm install -g pnpm` |
