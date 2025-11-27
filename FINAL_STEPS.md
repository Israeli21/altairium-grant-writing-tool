# 🚀 Final Steps to Generate Grant Proposals

## Current Status: 80% Complete! ✅

You have:
- ✅ Frontend with upload UI
- ✅ PDF storage in Supabase
- ✅ Text extraction from PDFs (Form 990, 1023, generic)
- ✅ Grant generation backend (built by Shrish)

## What's Left: 3 Steps to Launch

### Step 1: Create Database Function for Vector Search

Run this in **Supabase SQL Editor**:

```sql
-- Function to find similar documents using vector search
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  content text,
  similarity float
)
LANGUAGE sql
AS $$
  SELECT
    id,
    content,
    1 - (embedding <=> query_embedding) as similarity
  FROM document_embeddings
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
```

### Step 2: Generate Embeddings from Your Documents

You need **2 services running** + **1 script**:

**Terminal 1: PDF Extraction Service** (already running ✅)
```bash
cd src/backend
python -m uvicorn pyscrapepdf_utils:app --reload --port 8000
```

**Terminal 2: Embedding Service** (NEW - start this)
```bash
cd src/backend
python -m uvicorn embed:app --reload --port 8001
```

**Terminal 3: Create Embeddings** (run once per new upload)
```bash
cd src/backend
npx tsx createEmbeddings.ts
```

You should see:
```
🔍 Fetching documents needing embeddings...
📄 Found 4 document(s) to process

Processing: form990.pdf (990)
  🧮 Generating embedding...
  💾 Storing embedding...
  ✅ Success!

🎉 All embeddings created successfully!
```

### Step 3: Set Up Environment Variables

Add to `src/backend/.env`:

```env
# Existing
SUPABASE_URL=https://puvrqwssepacikufuelk.supabase.co
SUPABASE_SERVICE_KEY=your-service-key

# NEW - Add these:
PYTHON_EMBED_URL=http://localhost:8001/embed
HUGGINGFACE_TOKEN=your-hf-token-here
GEMINI_API_KEY=your-gemini-key-here
CLAUDE_API_KEY=your-claude-key-here
```

**Get API Keys:**
- **HuggingFace Token**: https://huggingface.co/settings/tokens (free)
- **Gemini API**: https://makersuite.google.com/app/apikey (free tier available)
- **Claude API**: https://console.anthropic.com/ (paid, but optional)

### Step 4: Wire Up the Frontend

Update `App.tsx` to call the grant generation:

In the `handleGenerate` function (around line 229), replace the setTimeout with:

```typescript
const handleGenerate = async () => {
  if (!grantApplicationId) {
    alert('Please save your grant information first!');
    return;
  }

  setIsGenerating(true);
  
  try {
    // Call backend to generate grant
    const response = await fetch('http://localhost:3000/generate-grant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userRequest: `Generate a grant proposal for ${grantInfo.nonprofitName} requesting ${grantInfo.fundingAmount} from ${grantInfo.grantorName}. ${grantInfo.additionalNotes}`,
        grantId: grantApplicationId,
        matchCount: 10
      })
    });

    if (!response.ok) throw new Error('Generation failed');
    
    const result = await response.json();
    console.log('Generated proposal:', result);
    
    // TODO: Display result.finalGrant in the UI
    alert('✅ Grant proposal generated! Check console for now.');
    
  } catch (error: any) {
    console.error('Generation error:', error);
    alert(`Error: ${error.message}`);
  } finally {
    setIsGenerating(false);
  }
};
```

### Step 5: Start the Generation Server

Shrish needs to create an Express/Fastify server that:
1. Listens on port 3000
2. Has a POST endpoint `/generate-grant`
3. Calls the `generateGrant.tsx` logic

Quick example:

```typescript
// src/backend/server.ts
import express from 'express';
import cors from 'cors';
import { generateGrant } from './generateGrant';

const app = express();
app.use(cors());
app.use(express.json());

app.post('/generate-grant', async (req, res) => {
  try {
    const result = await generateGrant(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log('🚀 Grant generation server running on port 3000');
});
```

## Quick Start (All Services)

```batch
# Terminal 1: Frontend
npm run dev

# Terminal 2: PDF Service
cd src/backend && python -m uvicorn pyscrapepdf_utils:app --reload --port 8000

# Terminal 3: Embedding Service
cd src/backend && python -m uvicorn embed:app --reload --port 8001

# Terminal 4: Generation Server (when ready)
cd src/backend && npx tsx server.ts

# Run once after uploading files:
cd src/backend
node scrape.js              # Extract PDF text
npx tsx createEmbeddings.ts  # Create embeddings
```

## Testing the Full Flow

1. **Upload documents** → Frontend saves to database
2. **Extract text** → `node scrape.js` fills `extracted_text`
3. **Create embeddings** → `npx tsx createEmbeddings.ts` fills `document_embeddings`
4. **Generate grant** → Click "Generate Draft Proposal" button
5. **See result** → Grant proposal appears in UI

## What Each Service Does

| Service | Port | Purpose |
|---------|------|---------|
| Frontend (Vite) | 5173 | User interface |
| PDF Extraction | 8000 | Parse Form 990/1023/PDFs |
| Embedding Service | 8001 | Convert text → vectors |
| Generation Server | 3000 | RAG + LLM → Grant proposal |

## Troubleshooting

**"No embeddings found"**
- Run `npx tsx createEmbeddings.ts` after uploading docs

**"Embedding service failed"**
- Check HuggingFace token in `.env`
- Make sure port 8001 is running

**"match_documents function does not exist"**
- Run the SQL function creation (Step 1)

**"Generation takes forever"**
- Normal! LLMs can take 30-60 seconds
- Check console for progress logs
