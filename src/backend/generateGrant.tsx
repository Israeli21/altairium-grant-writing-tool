// backend/orchestrator/generateGrant.ts

import 'dotenv/config';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
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
  console.log(`Calling embedding service at ${EMBED_URL}...`);

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
  console.log('Embedding service response:', { hasEmbedding: !!data.embedding, embeddingType: typeof data.embedding, embeddingLength: data.embedding?.length });
  // adjust this if your service returns a different shape
  return data.embedding as number[];
}

// ---------- Helper: RAG retrieval from Supabase ----------

async function retrieveContext(
  queryEmbedding: number[],
  matchCount: number
): Promise<{ id: string; content: string; similarity: number }[]> {
  console.log('Retrieving context. Query embedding length:', queryEmbedding?.length);
  
  // Bypass schema cache by using raw SQL query instead of RPC
  const { data, error } = await supabase
    .from('document_embeddings')
    .select('id, content, embedding')
    .limit(1000); // Get a reasonable sample
  
  if (error) {
    console.error('Supabase query error:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    console.log('No documents found in database');
    return [];
  }

  console.log(`Found ${data.length} documents in database`);

  // Calculate cosine similarity manually
  const results = data.map((doc: any, index: number) => {
    let embedding = doc.embedding;
    
    // Parse embedding if it's stored as string or object
    if (typeof embedding === 'string') {
      try {
        embedding = JSON.parse(embedding);
      } catch (e) {
        console.warn(`Document ${index} (id: ${doc.id}) has unparseable embedding string`);
        return { id: doc.id, content: doc.content, similarity: 0 };
      }
    }
    
    // Validate embedding
    if (!embedding || !Array.isArray(embedding)) {
      console.warn(`Document ${index} (id: ${doc.id}) has invalid embedding:`, typeof embedding);
      return {
        id: doc.id,
        content: doc.content,
        similarity: 0
      };
    }
    
    if (embedding.length !== queryEmbedding.length) {
      console.warn(`Document ${index} embedding length mismatch: ${embedding.length} vs ${queryEmbedding.length}`);
      return {
        id: doc.id,
        content: doc.content,
        similarity: 0
      };
    }
    
    // Cosine similarity: dot product / (magnitude1 * magnitude2)
    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;
    
    for (let i = 0; i < queryEmbedding.length; i++) {
      dotProduct += queryEmbedding[i] * embedding[i];
      mag1 += queryEmbedding[i] * queryEmbedding[i];
      mag2 += embedding[i] * embedding[i];
    }
    
    mag1 = Math.sqrt(mag1);
    mag2 = Math.sqrt(mag2);
    
    const similarity = mag1 > 0 && mag2 > 0 ? dotProduct / (mag1 * mag2) : 0;
    
    return {
      id: doc.id,
      content: doc.content,
      similarity: similarity
    };
  });

  // Sort by similarity (descending) and return top matches
  results.sort((a, b) => b.similarity - a.similarity);
  const topResults = results.slice(0, matchCount);
  console.log(`Returning top ${topResults.length} matches`);
  return topResults;
}

// ---------- Helpers: call OpenAI, Gemini + Claude ----------

async function callOpenAI(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAIKEY;
  if (!apiKey) throw new Error('OPENAIKEY not set');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4096
    })
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI API failed (${res.status}): ${body}`);
  }

  const data: any = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;
  
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }]
    })
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API failed (${res.status}): ${body}`);
  }

  const data: any = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

async function callClaude(prompt: string): Promise<string> {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) throw new Error('CLAUDE_API_KEY not set');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Claude API failed (${res.status}): ${body}`);
  }

  const data: any = await res.json();
  return data.content?.[0]?.text ?? '';
}

// ---------- Main Orchestrator ----------

export async function generateGrant(input: GenerateGrantInput): Promise<GenerateGrantResult> {
  const { userRequest, matchCount = 5 } = input;

  console.log('Step 1: Getting query embedding...');
  const queryEmbedding = await getQueryEmbedding(userRequest);
  
  if (!queryEmbedding || !Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
    console.error('Failed to get query embedding. Received:', queryEmbedding);
    throw new Error('Failed to generate query embedding - embedding service may be down');
  }
  
  console.log(`Successfully got query embedding with ${queryEmbedding.length} dimensions`);

  console.log('Step 2: Retrieving context from database...');
  const contextChunks = await retrieveContext(queryEmbedding, matchCount);

  const contextText = contextChunks
    .map((chunk, idx) => `[Document ${idx + 1}]:\n${chunk.content}`)
    .join('\n\n');

  console.log('Step 3: Proposer (OpenAI) drafting grant...');
  const proposerPrompt = `You are a grant writing expert. Using the following context from the nonprofit's documents, write a compelling grant proposal addressing this request:

Request: ${userRequest}

Context:
${contextText}

Write a comprehensive grant proposal with clear sections covering the problem, solution, impact, and budget considerations.`;

  const proposerDraft = await callOpenAI(proposerPrompt);

  console.log('Step 4: Challenger (OpenAI) critiquing...');
  const challengerPrompt = `You are a critical grant reviewer. Review this grant proposal and identify weaknesses, missing information, or areas that need improvement:

Original Request: ${userRequest}

Proposal:
${proposerDraft}

Provide constructive criticism and suggest specific improvements.`;

  const challengerDraft = await callOpenAI(challengerPrompt);

  console.log('Step 5: Referee (OpenAI) synthesizing final grant...');
  const refereePrompt = `You are the final arbiter synthesizing the best grant proposal. 

Original Request: ${userRequest}

Initial Proposal:
${proposerDraft}

Critique:
${challengerDraft}

Create the final, polished grant proposal incorporating the valid criticisms and improvements. Make it compelling, well-structured, and professional.`;

  const finalGrant = await callOpenAI(refereePrompt);

  const refereeSummary = `Synthesized proposal incorporating feedback. Key improvements made based on critical review.`;

  return {
    finalGrant,
    proposerDraft,
    challengerDraft,
    refereeSummary,
    contextChunks
  };
}
