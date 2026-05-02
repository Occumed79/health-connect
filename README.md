# HealthConnect Recovered Current Build

Recovered from `bundle.js.map` uploaded from `healthconnect-94.preview.emergentagent.com`.

## What is included

- Current recovered React frontend source from the source map
- Reconstructed FastAPI backend matching the frontend API calls
- Safe example environment files
- No exposed API keys or Emergent/PostHog/VWO tracking junk

## Run backend

```bash
cd backend
cp .env.example .env
pip install -r requirements.txt
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

## Run frontend

```bash
cd frontend
cp .env.example .env
yarn install
yarn start
```

## Known limitations

The frontend source is directly recovered from the source map. The backend is reconstructed because the original backend source was not exposed through the browser bundle. The live API currently returns an empty provider list, so database records were not recoverable from `/api/providers`.
