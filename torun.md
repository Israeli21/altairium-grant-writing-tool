# 🚀 Grant Generation Pipeline - Setup Guide

## Prerequisites

- Node.js 18+
- Python 3.8+
- Supabase account with:
  - `uploaded_documents` table
  - `document_embeddings` table with `vector(768)` column
  - `match_documents` RPC function

---

## Environment Variables

Create a `.env` file in the project root:

```env
# Supabase
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_role_key

# OpenAI
OPENAI_KEY=your_openai_key

# HuggingFace
HUGGINGFACE_TOKEN=your_hf_token
```

---

## Step 1: Install Dependencies

```powershell
# Node dependencies (from project root)
npm install

# Backend Node dependencies
cd src/backend
npm install

# Python dependencies
pip install fastapi uvicorn python-dotenv huggingface_hub numpy PyMuPDF requests
```

---

## Step 2: Start Services (4 terminals)

### Terminal 1 - Python Scraper (port 8000)

```powershell
cd src/backend
python3 -m uvicorn pyscrapepdf_utils:app --reload --port 8000
```

### Terminal 2 - Python Embeddings (port 8001)

```powershell
cd src/backend
python3 -m uvicorn embed:app --reload --port 8001
```

### Terminal 3 - Express Backend (port 3000)

```powershell
cd src/backend
npx tsx server.ts
```

### Terminal 4 - Frontend (port 5173)

```powershell
npm run dev
```

---

## Step 3: Process Documents

If you have existing documents in `uploaded_documents` table that need embeddings:

```powershell
cd src/backend
npx tsx createEmbeddings.ts
```

Or call the API with specific document IDs:

```powershell
$body = '{"documentIds": ["uuid-1", "uuid-2"]}'
Invoke-WebRequest -Uri "http://localhost:3000/process-documents" -Method POST -ContentType "application/json" -Body $body
```

---

## Step 4: Generate Grant

### Via API

```powershell
$body = '{"userRequest": "Write a grant for our robotics program"}'
Invoke-WebRequest -Uri "http://localhost:3000/generate-grant" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 180
```

### Via Frontend

1. Go to http://localhost:5173
2. Fill in grant info (nonprofit name, grantor, funding amount)
3. Upload documents (Form 990, Form 1023, past projects)
4. Click "Next" → documents are processed into embeddings
5. Click "Generate Draft" → grant is generated with RAG context

---

## Quick Reference - Service URLs

| Service    | Port | Endpoint                                                         |
| ---------- | ---- | ---------------------------------------------------------------- |
| Scraper    | 8000 | `POST /scrape`                                                   |
| Embeddings | 8001 | `POST /embed`                                                    |
| Backend    | 3000 | `POST /generate-grant`, `POST /process-documents`, `GET /health` |
| Frontend   | 5173 | Web UI                                                           |

---

## Pipeline Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│  1. UPLOAD DOCUMENTS                                                    │
│     └─→ Files stored in Supabase Storage                               │
│     └─→ Metadata saved to uploaded_documents table                     │
├─────────────────────────────────────────────────────────────────────────┤
│  2. PROCESS DOCUMENTS (POST /process-documents)                        │
│     └─→ Scrape PDFs via Python service (port 8000)                     │
│     └─→ Extract text based on form type (990, 1023, past_project)      │
│     └─→ Generate embeddings via Python service (port 8001)             │
│     └─→ Store embeddings in document_embeddings table                  │
├─────────────────────────────────────────────────────────────────────────┤
│  3. GENERATE GRANT (POST /generate-grant)                              │
│     └─→ Embed user query                                               │
│     └─→ RAG retrieval: find similar document chunks                    │
│     └─→ Build prompts with context                                     │
│     └─→ Generate sections via OpenAI                                   │
│     └─→ Assemble final grant proposal                                  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Troubleshooting

### "Embedding service error: 401 Unauthorized"

- Add `HUGGINGFACE_TOKEN` to `.env`
- Restart the embed.py service

### "No module named 'fitz'"

- Run: `pip install PyMuPDF`

### "Embedding dimension mismatch"

- Run this SQL in Supabase:
  ```sql
  ALTER TABLE document_embeddings ALTER COLUMN embedding TYPE vector(768);
  ```

### "Documents not found"

- Make sure `SUPABASE_SERVICE_KEY` is set (bypasses RLS)

### Server not responding

- Check all 4 services are running on correct ports
