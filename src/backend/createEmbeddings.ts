/**
 * createEmbeddings.ts
 * Generates embeddings from extracted_text in uploaded_documents
 * and stores them in document_embeddings table
 */

import 'dotenv/config';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

const PYTHON_EMBED_URL = process.env.PYTHON_EMBED_URL || 'http://localhost:8000/embed';

interface Document {
  id: string;
  grant_id: string;
  file_name: string;
  file_type: string;
  extracted_text: string;
}

// Fetch documents that have extracted_text but no embeddings
async function fetchDocumentsNeedingEmbeddings(): Promise<Document[]> {
  const { data, error } = await supabase
    .from('uploaded_documents')
    .select('id, grant_id, file_name, file_type, extracted_text')
    .not('extracted_text', 'is', null);

  if (error) throw error;

  // Filter out documents that already have embeddings
  const embeddedIds = await getEmbeddedDocumentIds();
  return (data || []).filter(doc => !embeddedIds.has(doc.id));
}

async function getEmbeddedDocumentIds(): Promise<Set<string>> {
  // For now, just return empty set since we can check during insert
  // The database will handle duplicates
  return new Set();
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
  embedding: number[]
): Promise<void> {
  const { error } = await supabase
    .from('document_embeddings')
    .insert({
      grant_id: grantId,
      content: content,
      embedding: embedding
    });

  if (error) throw error;
}

// Main function
async function processDocumentEmbeddings() {
  try {
    console.log('Fetching documents needing embeddings...');
    const documents = await fetchDocumentsNeedingEmbeddings();

    if (documents.length === 0) {
      console.log('No documents need embeddings. All done!');
      return;
    }

    console.log(`Found ${documents.length} document(s) to process\n`);

    for (const doc of documents) {
      console.log(`Processing: ${doc.file_name} (${doc.file_type})`);

      // Parse the extracted_text JSON
      let textContent: string;
      try {
        const parsed = JSON.parse(doc.extracted_text);
        
        // Extract meaningful text based on document type
        if (doc.file_type === '990') {
          textContent = [
            parsed.mission || '',
            JSON.stringify(parsed.programs || []),
            parsed.schedule_o || ''
          ].filter(Boolean).join('\n');
        } else if (doc.file_type === '1023') {
          textContent = Object.values(parsed)
            .filter(v => typeof v === 'string')
            .join('\n');
        } else {
          // past_project or generic
          textContent = parsed.raw_text || JSON.stringify(parsed);
        }

        if (!textContent.trim()) {
          console.log(`Skipping - no text content found`);
          continue;
        }

        // Generate embedding
        console.log('Generating embedding...');
        const embedding = await generateEmbedding(textContent.substring(0, 5000)); // Limit to first 5000 chars

        // Store in database
        console.log('Storing embedding...');
        await storeEmbedding(doc.id, doc.grant_id, textContent, embedding);

        console.log('Success!\n');

      } catch (parseError) {
        console.error(`Error processing ${doc.file_name}:`, parseError);
        continue;
      }
    }

    console.log('All embeddings created successfully!');

  } catch (error) {
    console.error('Fatal error:', error);
    throw error;
  }
}

// Run it
processDocumentEmbeddings().catch(console.error);