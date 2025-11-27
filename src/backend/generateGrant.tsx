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
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  
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

  console.log('Step 2: Retrieving context from database...');
  const contextChunks = await retrieveContext(queryEmbedding, matchCount);

  const contextText = contextChunks
    .map((chunk, idx) => `[Document ${idx + 1}]:\n${chunk.content}`)
    .join('\n\n');

  console.log('Step 3: Proposer (Gemini) drafting grant...');
  const proposerPrompt = `You are a grant writing expert. Using the following context from the nonprofit's documents, write a compelling grant proposal addressing this request:

Request: ${userRequest}

Context:
${contextText}

Write a comprehensive grant proposal with clear sections covering the problem, solution, impact, and budget considerations.`;

  const proposerDraft = await callGemini(proposerPrompt);

  console.log('Step 4: Challenger (Claude) critiquing...');
  const challengerPrompt = `You are a critical grant reviewer. Review this grant proposal and identify weaknesses, missing information, or areas that need improvement:

Original Request: ${userRequest}

Proposal:
${proposerDraft}

Provide constructive criticism and suggest specific improvements.`;

  let challengerDraft = '';
  try {
    challengerDraft = await callClaude(challengerPrompt);
  } catch (error) {
    console.warn('Claude API not available, using Gemini for challenger:', error);
    challengerDraft = await callGemini(challengerPrompt);
  }

  console.log('Step 5: Referee (Gemini) synthesizing final grant...');
  const refereePrompt = `You are the final arbiter synthesizing the best grant proposal. 

Original Request: ${userRequest}

Initial Proposal:
${proposerDraft}

Critique:
${challengerDraft}

Create the final, polished grant proposal incorporating the valid criticisms and improvements. Make it compelling, well-structured, and professional.`;

  const finalGrant = await callGemini(refereePrompt);

  const refereeSummary = `Synthesized proposal incorporating feedback. Key improvements made based on critical review.`;

  return {
    finalGrant,
    proposerDraft,
    challengerDraft,
    refereeSummary,
    contextChunks
  };
}
