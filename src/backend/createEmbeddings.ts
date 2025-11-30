/**
 * createEmbeddings.ts
 * Scrapes PDFs (if needed) and generates embeddings from extracted_text
 * Stores embeddings in document_embeddings table
 * 
 * Incorporates logic from scrape.ts for PDF scraping
 */

import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

import fetch from 'node-fetch';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Default client for standalone script usage
const defaultSupabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
);

// Service URLs - pyscrapepdf_utils.py on 8000, embed.py on 8001
const PYTHON_SCRAPER_URL = process.env.PYTHON_SCRAPER_URL || 'http://localhost:8000/scrape';
const PYTHON_EMBED_URL = process.env.PYTHON_EMBED_URL || 'http://localhost:8001/embed';

export interface Document {
  id: string;
  grant_id: string;
  file_name: string;
  file_type: string;
  file_url: string | null;
  extracted_text: string | null;
}

export interface ProcessResult {
  docId: string;
  fileName: string;
  status: 'success' | 'error' | 'skipped';
  message?: string;
}

// Fetch documents that have extracted_text but no embeddings
async function fetchDocumentsNeedingEmbeddings(supabase: SupabaseClient = defaultSupabase): Promise<Document[]> {
  const { data, error } = await supabase
    .from('uploaded_documents')
    .select('id, grant_id, file_name, file_type, file_url, extracted_text')
    .not('extracted_text', 'is', null);

  if (error) throw error;

  // Filter out documents that already have embeddings
  const embeddedIds = await getEmbeddedDocumentIds(supabase);
  return (data || []).filter(doc => !embeddedIds.has(doc.id));
}

// Fetch specific documents by IDs (includes those needing scraping)
async function fetchDocumentsByIds(documentIds: string[], supabase: SupabaseClient = defaultSupabase): Promise<Document[]> {
  const { data, error } = await supabase
    .from('uploaded_documents')
    .select('id, grant_id, file_name, file_type, file_url, extracted_text')
    .in('id', documentIds);

  if (error) throw error;
  return data || [];
}

// Types from scrape.ts
interface ScraperResult {
  url: string;
  form_type: string;
  data: Record<string, any>;
}

// Scrape PDF to extract text using Python service (from scrape.ts)
async function scrapePdf(fileUrl: string): Promise<{ text: string; formType: string }> {
  console.log(`  📄 Scraping PDF from: ${fileUrl.substring(0, 60)}...`);
  
  const response = await fetch(PYTHON_SCRAPER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls: [fileUrl] })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Scraper service error (${response.status}): ${errorText}`);
  }

  const results = await response.json() as ScraperResult[];
  
  if (!results || !results[0]) {
    throw new Error('No results from scraper');
  }

  const result = results[0];
  const extractedText = result.data ? JSON.stringify(result.data) : '';
  
  console.log(`  ✅ Scraped ${extractedText.length} characters (form_type: ${result.form_type})`);
  return { text: extractedText, formType: result.form_type };
}

async function getEmbeddedDocumentIds(supabase: SupabaseClient = defaultSupabase): Promise<Set<string>> {
  const { data } = await supabase
    .from('document_embeddings')
    .select('uploaded_document_id');
  
  return new Set((data || []).map(d => d.uploaded_document_id).filter(Boolean));
}

// Call Python embedding service
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch(PYTHON_EMBED_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: text })
  });

  if (!response.ok) {
    throw new Error(`Embedding service error: ${response.statusText}`);
  }

  const result = await response.json() as { embedding: number[], text: string };
  return result.embedding;
}

// Store embedding in database
async function storeEmbedding(
  documentId: string,
  grantId: string,
  content: string,
  embedding: number[],
  supabase: SupabaseClient = defaultSupabase
): Promise<void> {
  const { error } = await supabase
    .from('document_embeddings')
    .insert({
      uploaded_document_id: documentId,
      grant_id: grantId,
      content: content,
      embedding: embedding,
      created_at: new Date().toISOString()
    });

  if (error) throw error;
}

// Parse extracted text based on document type
function parseExtractedText(extractedText: string, fileType: string): string {
  try {
    const parsed = JSON.parse(extractedText);
    
    if (fileType === '990') {
      return [
        parsed.mission || '',
        JSON.stringify(parsed.programs || []),
        parsed.schedule_o || ''
      ].filter(Boolean).join('\n');
    } else if (fileType === '1023') {
      return Object.values(parsed)
        .filter(v => typeof v === 'string')
        .join('\n');
    } else {
      // past_project or generic
      return parsed.raw_text || JSON.stringify(parsed);
    }
  } catch {
    // If not JSON, return as-is
    return extractedText;
  }
}

// Process a single document: scrape if needed, then create embedding
async function processDocument(
  doc: Document,
  supabase: SupabaseClient = defaultSupabase
): Promise<ProcessResult> {
  console.log(`\nProcessing: ${doc.file_name} (${doc.file_type})`);

  try {
    let extractedText = doc.extracted_text;
    let fileType = doc.file_type;

    // Step 1: If no extracted_text, scrape the PDF
    if (!extractedText) {
      if (!doc.file_url) {
        return { docId: doc.id, fileName: doc.file_name, status: 'skipped', message: 'No file_url to scrape' };
      }

      console.log(`  No extracted_text found, scraping PDF...`);
      const scrapeResult = await scrapePdf(doc.file_url);
      extractedText = scrapeResult.text;
      fileType = scrapeResult.formType || fileType;

      // Save extracted text and form_type back to database (like scrape.ts does)
      const { error: updateError } = await supabase
        .from('uploaded_documents')
        .update({ 
          extracted_text: extractedText,
          file_type: fileType,
          processed_at: new Date().toISOString()
        })
        .eq('id', doc.id);

      if (updateError) {
        console.warn(`  ⚠️ Could not save extracted_text: ${updateError.message}`);
      } else {
        console.log(`  ✅ Saved extracted_text to database`);
      }
    }

    if (!extractedText) {
      return { docId: doc.id, fileName: doc.file_name, status: 'skipped', message: 'No text to process' };
    }

    // Step 2: Parse the extracted text based on document type
    const textContent = parseExtractedText(extractedText, fileType);
    
    if (!textContent.trim()) {
      return { docId: doc.id, fileName: doc.file_name, status: 'skipped', message: 'No text content found after parsing' };
    }

    // Step 3: Generate embedding (limit to 5000 chars)
    console.log(`  Generating embedding for ${textContent.length} chars...`);
    const embedding = await generateEmbedding(textContent.substring(0, 5000));

    // Step 4: Store embedding in database
    console.log(`  Storing embedding...`);
    await storeEmbedding(doc.id, doc.grant_id, textContent, embedding, supabase);

    console.log(`  ✅ Success!`);
    return { docId: doc.id, fileName: doc.file_name, status: 'success' };

  } catch (error: any) {
    console.error(`  ❌ Error: ${error.message}`);
    return { docId: doc.id, fileName: doc.file_name, status: 'error', message: error.message };
  }
}

// EXPORTED: Process specific documents by IDs (called from server endpoint)
export async function processDocumentsByIds(
  documentIds: string[],
  supabaseClient?: SupabaseClient
): Promise<ProcessResult[]> {
  const supabase = supabaseClient || defaultSupabase;
  const results: ProcessResult[] = [];

  console.log(`\n📄 Processing ${documentIds.length} document(s)...`);
  
  const documents = await fetchDocumentsByIds(documentIds, supabase);
  
  if (documents.length === 0) {
    console.log('No documents found with provided IDs');
    return documentIds.map(id => ({ 
      docId: id, 
      fileName: 'unknown', 
      status: 'error' as const, 
      message: 'Document not found' 
    }));
  }

  for (const doc of documents) {
    const result = await processDocument(doc, supabase);
    results.push(result);
  }

  console.log(`\n✅ Processing complete: ${results.filter(r => r.status === 'success').length}/${results.length} successful\n`);
  return results;
}

// EXPORTED: Process all documents needing embeddings (for batch processing)
export async function processAllPendingDocuments(
  supabaseClient?: SupabaseClient
): Promise<ProcessResult[]> {
  const supabase = supabaseClient || defaultSupabase;
  const results: ProcessResult[] = [];

  console.log('\n📄 Fetching documents needing embeddings...');
  const documents = await fetchDocumentsNeedingEmbeddings(supabase);

  if (documents.length === 0) {
    console.log('No documents need embeddings. All done!');
    return [];
  }

  console.log(`Found ${documents.length} document(s) to process\n`);

  for (const doc of documents) {
    const result = await processDocument(doc, supabase);
    results.push(result);
  }

  console.log(`\n✅ All embeddings created: ${results.filter(r => r.status === 'success').length}/${results.length} successful\n`);
  return results;
}

// CLI: Run as standalone script
const isMainModule = process.argv[1]?.includes('createEmbeddings');
if (isMainModule) {
  processAllPendingDocuments().catch(console.error);
}