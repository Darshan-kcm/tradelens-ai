# Running TradeLens AI locally in VS Code

Everything below assumes you have the project folder on your machine, either
downloaded as a zip or cloned from GitHub.

---

## 1. What you need installed

| Tool | Version | Check with |
|---|---|---|
| Python | 3.11+ | `python --version` |
| Node.js | 20+ | `node --version` |
| Yarn | 1.22+ | `yarn --version` (install: `npm i -g yarn`) |
| MongoDB | 6+ (local server) | `mongod --version` |

MongoDB options:
- **Local install** — https://www.mongodb.com/try/download/community, then make sure
  the `mongod` service is running.
- **Docker (easiest)** — `docker run -d -p 27017:27017 --name tradelens-mongo mongo:7`
- **MongoDB Atlas (free cloud)** — create a cluster and copy its connection string
  into `MONGO_URL` in step 3.

> The project brief specified PostgreSQL; this build uses MongoDB with the same
> logical schema and collection names. All DB code lives in `backend/lib/db.py`
> and `backend/lib/store.py` — see README section 1 for the porting note.

---

## 2. Open the folder

```bash
code tradelens-ai
```

VS Code will offer to install the recommended extensions (Python, Pylance,
Tailwind CSS IntelliSense, MongoDB). Accept — they are listed in
`.vscode/extensions.json`.

---

## 3. Create the backend `.env`

```bash
cd backend
cp .env.example .env        # Windows: copy .env.example .env
```

Default contents work with a local MongoDB:

```
MONGO_URL="mongodb://localhost:27017"
DB_NAME="tradelens"
CORS_ORIGINS="*"
```

If you use Atlas, replace `MONGO_URL` with your cluster string.

---

## 4. Install and seed (one time)

### Option A — VS Code tasks (no typing)
`Terminal → Run Task…` and run, in order:

1. **1. Install backend deps**
2. **2. Seed demo data**
3. **3. Install frontend deps**

### Option B — terminal

```bash
# backend
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python seed.py                     # loads 36 assets × 400 daily bars + news + fundamentals

# frontend
cd ../frontend
yarn install
```

`seed.py` is idempotent — safe to re-run any time you want a clean dataset.

---

## 5. Run it (two processes)

### Option A — VS Code
- `Terminal → Run Task… → Run BOTH (backend + frontend)`
- Or press **F5** and pick **Backend: FastAPI (uvicorn)** to run the backend with
  the debugger attached (breakpoints work in routers and `lib/`), then run the
  frontend task separately.

### Option B — two terminals

```bash
# terminal 1
cd backend && source .venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# terminal 2
cd frontend && yarn dev
```

| URL | What |
|---|---|
| http://localhost:3000 | the app |
| http://localhost:8001/docs | interactive Swagger API docs |

Log in with **demo@tradelens.ai / demo123** (or student@tradelens.ai / student123).

The frontend calls relative `/api/...` paths and Vite proxies them to port 8001
(`frontend/vite.config.ts`), so there is no API URL to configure.

---

## 6. Useful commands

```bash
cd frontend && yarn typecheck     # TypeScript check (must pass before you submit)
cd frontend && yarn lint          # lint
cd frontend && yarn build         # production build into frontend/dist
cd backend  && pytest             # backend tests (needs the API running)
cd backend  && python -c "import server"   # quick import/syntax check
```

---

## 7. Troubleshooting

| Symptom | Fix |
|---|---|
| Pages show "Backend data is unavailable" | backend not running, or `.env` missing — start uvicorn on 8001 |
| Tables and charts are empty | you skipped `python seed.py` |
| `pymongo.errors.ServerSelectionTimeoutError` | MongoDB isn't running, or `MONGO_URL` is wrong |
| `Port 3000 is in use` | `yarn dev --port 3001` (the proxy still points at 8001) |
| Login always fails | re-run `python seed.py` to recreate the demo users |
| VS Code can't resolve Python imports | select the interpreter `backend/.venv/bin/python` via `Python: Select Interpreter` |

---

## 8. Where to look in the code (for the viva)

| Question | File |
|---|---|
| "How is RSI/EMA calculated?" | `backend/lib/analytics.py` |
| "How does the screener filter?" | `backend/routers/research.py` → `run_screener` |
| "How does the backtester work?" | `backend/lib/backtester.py` |
| "Where does the Research Score come from?" | `backend/lib/store.py` → `build_snapshot` |
| "Where is the demo data made?" | `backend/lib/demodata.py` |
| "How does the frontend call the API?" | `frontend/src/lib/api.ts` + `frontend/src/lib/types.ts` |
| "Where is each screen?" | `frontend/src/pages/*.tsx`, routed in `frontend/src/App.tsx` |
