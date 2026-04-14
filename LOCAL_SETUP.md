# Local Development Setup (Windows)

## Architecture

| Service | Port | Description |
|---------|------|-------------|
| API Server | 3001 | Express + Node.js backend, connects to Supabase |
| Frontend | 3000 | React + Vite dev server, proxies `/api` → `localhost:3001` |

---

## Why "Connection terminated unexpectedly"?

If your Supabase password contains special characters like `&` or `%`,
the full URL method **will silently fail** because:
- `&` is treated as a URL query-string separator → password gets cut off
- `%` must be encoded as `%25`

**The fix: use individual variables instead of the full URL.**

---

## Step 1 — Create config.bat (gitignored, stays on your machine only)

Create a file named `config.bat` in the project root.

### Recommended method — individual variables (no encoding issues):

```bat
@echo off
set "DB_HOST=aws-1-ap-southeast-2.pooler.supabase.com"
set "DB_PORT=6543"
set "DB_USER=postgres.dnicziexvhfizobxkejn"
set "DB_PASSWORD=FPy&7a42&F%yji"
set "DB_NAME=postgres"
```

> Fill in your actual host, user, and password from the Supabase dashboard.
> With this method, the password is used as-is — no URL encoding needed.

### Alternative — full URL (only if password has NO special chars):

```bat
@echo off
set "SUPABASE_DATABASE_URL=postgresql://user:password@host:6543/postgres"
```

> If your password contains `&` or `%`, use the individual variables above instead.

---

## Step 2 — Install prerequisites

- [Node.js LTS](https://nodejs.org)
- pnpm: `npm install -g pnpm`

---

## Step 3 — Clone and install

```bash
git clone https://github.com/Nanif/budget-app-new.git
cd budget-app-new
pnpm install
```

---

## Step 4 — Build API server

```bash
pnpm --filter api-server run build
```

---

## Step 5 — Start the app

Double-click **`start.bat`** — it handles everything automatically:
- Runs `pnpm install`
- Builds the API if needed
- Opens two CMD windows (API + Frontend)
- Opens the browser at http://localhost:3000

> Both CMD windows must stay open while using the app.

---

## Manual start (optional)

**Terminal 1 — API Server:**
```bat
call config.bat
set PORT=3001
set NODE_ENV=production
node artifacts\api-server\dist\index.mjs
```

**Terminal 2 — Frontend:**
```bat
cd artifacts\budget-app
pnpm exec vite --config vite.config.local.ts
```

---

## Health check

To verify the API and DB are working:
```
http://localhost:3001/api/healthz
```
Should return: `{"status":"ok"}`

---

## Common Issues

| Problem | Cause | Fix |
|---------|-------|-----|
| `Connection terminated unexpectedly` | `&` or `%` in password breaks URL parsing | Use individual DB vars (DB_HOST, DB_PASSWORD...) in config.bat |
| `Cannot find module @rollup/rollup-win32-x64-msvc` | First run on Windows | Run `pnpm install` again, or run `start.bat` (it does this automatically) |
| `PORT is required` | Running wrong vite config | Use `vite.config.local.ts`, not `vite.config.ts` |
| API returns HTML instead of JSON | Proxy not loaded | Make sure you're inside `artifacts/budget-app` when running vite |
| `config.bat not found` | Missing config file | Create `config.bat` as described in Step 1 |
| `pnpm not found` | pnpm not installed | Run `npm install -g pnpm` |
