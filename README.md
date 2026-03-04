# Claude Clone

## Quick Start

### Backend (Terminal 1)
```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run dev
```

### Frontend (Terminal 2)
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Deploy to Render
Push to GitHub, connect repo in Render, use the included render.yaml.
Set these env vars in Render dashboard:
- ANTHROPIC_API_KEY
- DATABASE_URL / DIRECT_URL
- GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
- GOOGLE_CALLBACK_URL = https://YOUR-BACKEND.onrender.com/auth/google/callback
- FRONTEND_URL = https://YOUR-FRONTEND.vercel.app
