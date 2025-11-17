// backend/orchestrator/generateGrant.ts

import 'dotenv/config';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ---------- Types ----------

export interface GenerateGrantInput {
  userRequest: string;           //"Write a grant for our robotics program...
  nonprofitId?: string;          //  filter documents by org
  matchCount?: number;           // how many RAG chunks to pull
}

export interface GenerateGrantResult {
  finalGrant: string;
  proposerDraft: string;
  challengerDraft: string;
  refereeSummary: string;
  contextChunks: { id: string; content: string; similarity: number }[];
}

// ---------- Helper: get query embedding from your Python service ----------

async function getQueryEmbedding(text: string): Promise<number[]> {
  const EMBED_URL = process.env.PYTHON_EMBED_URL ?? 'http://localhost:8000/embed';

  const res = await fetch(EMBED_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: text })
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Embedding service failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  // adjust this if your service returns a different shape
  return data.embedding as number[];
}

// ---------- Helper: RAG retrieval from Supabase ----------

async function retrieveContext(
  queryEmbedding: number[],
  matchCount: number
): Promise<{ id: string; content: string; similarity: number }[]> {
  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding: queryEmbedding,
    match_count: matchCount
  });

  if (error) {
    console.error('Supabase match_documents error:', error);
    throw error;
  }

  // you can add filtering by nonprofitId here later if your RPC supports it
  return data ?? [];
}

// ---------- Helpers: call Gemini + Claude ----------

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) thro
