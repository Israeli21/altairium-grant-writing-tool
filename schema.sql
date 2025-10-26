-- Table for User Authentication
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- Table for Meta data from input (Embeddings will be created from this)
CREATE TABLE grant_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  organization_name TEXT,
  project_title TEXT,
  grantor_name TEXT,
  funding_amount NUMERIC,
  project_description TEXT,
  grant_opportunity_url TEXT,
  structure_type TEXT, -- e.g. 'Standard', 'Federal'
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Table for Uploaded documents (Embeddings will be created from this)
CREATE TABLE uploaded_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id UUID REFERENCES grant_applications(id),
  file_name TEXT,
  file_type TEXT, -- '990','1023','past_project'
  file_url TEXT, -- Supabase Storage URL
  extracted_text TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- Table for Scraped Grant Website (from URL) 
CREATE TABLE scraped_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id UUID REFERENCES grant_applications(id),
  url TEXT,
  content_type TEXT, -- 'html','pdf'
  http_status INT,
  page_title TEXT,
  screenshot_url TEXT,
  fetched_at TIMESTAMP DEFAULT now(),
  text_content TEXT, -- full cleaned text
  metadata JSONB, -- parsed info (deadline, eligibility, etc.)
  status TEXT DEFAULT 'pending' -- 'pending','success','failed'
);

-- Table for Scraped Chunks (Embeddings will be created from this)
CREATE TABLE scraped_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID REFERENCES scraped_resources(id),
  chunk_index INT,
  chunk_text TEXT,
  created_at TIMESTAMP DEFAULT now()
);


-- Table for all embedding (pgvector table)
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE document_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT, -- 'uploaded' or 'scraped'
  source_id UUID, -- references either uploaded_documents.id or scraped_chunks.id
  grant_id UUID REFERENCES grant_applications(id),
  content TEXT,
  embedding VECTOR(1536),
  created_at TIMESTAMP DEFAULT now()
);

-- for faster retrieval ^
-- CREATE INDEX ON document_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Table for generated proposed sections
CREATE TABLE proposal_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id UUID REFERENCES grant_applications(id),
  section_name TEXT,
  content TEXT,
  tokens_used INT,
  created_at TIMESTAMP DEFAULT now(),
  model_used TEXT
);

-- Table for generation logs
CREATE TABLE generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id UUID REFERENCES grant_applications(id),
  section_name TEXT,
  retrieval_time_ms INT,
  generation_time_ms INT,
  context_sources JSONB, -- which docs/urls were retrieved
  hallucination_score FLOAT,
  created_at TIMESTAMP DEFAULT now()
);

-- Index for faster vector similarity search (uncomment after data is inserted)
-- CREATE INDEX ON document_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);