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

.env

NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://postgres.sqspmgcnqpkitaibpdqu:Kragunath2596%40@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.sqspmgcnqpkitaibpdqu:Kragunath2596%40@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require
ANTHROPIC_API_KEY=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
GROQ_API_KEY=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
GEMINI_API_KEY=AIzaSyApHr-GYhamEiszmYtrg4qvCw9hs_FfVgI
OPENAI_API_KEY=sk-your-openai-key-here
JWT_SECRET=claude-clone-jwt-secret-2024
SESSION_SECRET=claude-clone-session-secret-2024
GOOGLE_CLIENT_ID=700160989-ove29qb064ejcseeiitpk96nh4ij63a2.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
GOOGLE_CALLBACK_URL=https://claude-clone.onrender.com/auth/google/callback
FRONTEND_URL=https://rkai-frontend.onrender.com
UPLOAD_DIR=uploads
MAX_FILE_SIZE=10485760