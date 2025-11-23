/**
 * scrape.ts
 * TypeScript version of document scraping orchestration
 * 
 * Created by Shrish Vishnu Rajesh Kumar on 10/27/25
 * Converted to TypeScript on 11/23/25
 */

import 'dotenv/config';
import fetch from 'node-fetch';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase client setup
const supabase: SupabaseClient = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

const PYTHON_SCRAPER_URL = "http://localhost:8000/scrape";

// Type definitions
interface UploadedDocument {
  id: string;
  file_name: string;
  file_url: string;
  file_type: '990' | '1023' | 'past_project';
  extracted_text: string | null;
}

interface ScraperResult {
  url: string;
  form_type: string;
  data: Record<string, any>;
}

interface ScraperResponse {
  results?: ScraperResult[];
}

// Step 1: Fetch PDFs to process from uploaded_documents table
async function fetchDocuments(limit: number = 5): Promise<UploadedDocument[]> {
  const { data, error } = await supabase
    .from('uploaded_documents')
    .select('id, file_name, file_url, file_type, extracted_text')
    .is('extracted_text', null)
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// Step 2: Send PDF URLs to Python microservice
async function sendToService(urls: string[]): Promise<ScraperResult[]> {
  const response = await fetch(PYTHON_SCRAPER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ urls })
  });

  if (!response.ok) {
    throw new Error(`Scraper error: ${response.statusText}`);
  }

  const data = await response.json() as ScraperResult[];
  return data;
}

// Step 3: Insert results back into Supabase
async function storeResults(results: ScraperResult[]): Promise<void> {
  for (const result of results) {
    const { url, data, form_type } = result;
    
    const { error } = await supabase
      .from('uploaded_documents')
      .update({
        extracted_text: JSON.stringify(data),
        file_type: form_type,
        processed_at: new Date().toISOString()
      })
      .eq('file_url', url);

    if (error) {
      console.error(`Failed to update ${url}:`, error);
    }
  }
}

// Main orchestration
async function processBatch(): Promise<void> {
  try {
    const documents = await fetchDocuments(5);
    
    if (!documents.length) {
      console.log("No unprocessed documents found");
      return;
    }

    const urls = documents.map(d => d.file_url);
    console.log("Sending to scraper:", urls);

    const results = await sendToService(urls);
    console.log("Scraper results:", results);

    await storeResults(results);
    console.log("✅ All documents processed and stored.");
  } catch (error) {
    console.error("❌ Error processing batch:", error);
    throw error;
  }
}

// Run the batch processor
processBatch().catch(console.error);
