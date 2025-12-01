import 'dotenv/config'
import * as readline from 'readline'
import * as fs from 'fs'
import * as path from 'path'
import fetch from 'node-fetch'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../database.types'
import { fetchGrantContext } from './services/fetchGrantContext'
import { callDebate } from './services/callDebate'
import type {
  GenerationDependencies,
  GenerationSectionName,
} from './services/types'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
const PYTHON_SCRAPER_URL = process.env.PYTHON_SCRAPER_URL || 'http://localhost:8000/scrape'
const PYTHON_EMBED_URL = process.env.PYTHON_EMBED_URL || 'http://localhost:8000/embed'

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Default sections to generate
const DEFAULT_SECTIONS: GenerationSectionName[] = [
  'executive_summary',
  'needs_statement',
  'program_description',
  'budget_overview',
]

interface EmbeddingResponse {
  embedding: number[]
  text: string
}

// Helper: Prompt user for input
function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

// Step 1: Upload PDF to Supabase Storage
async function uploadPdfToStorage(filePath: string): Promise<string> {
  console.log('\nStep 1: Uploading PDF to Supabase Storage...')
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`)
  }

  const fileName = path.basename(filePath)
  const fileBuffer = fs.readFileSync(filePath)
  const storageBucket = 'documents' // Adjust if your bucket has a different name
  const storagePath = `test/${Date.now()}-${fileName}`

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(storageBucket)
    .upload(storagePath, fileBuffer, {
      contentType: 'application/pdf',
      upsert: false,
    })

  if (uploadError) {
    if (uploadError.message.includes('not found')) {
      throw new Error(`Storage bucket '${storageBucket}' not found. Please create it in Supabase dashboard.`)
    }
    throw uploadError
  }

  const { data: { publicUrl } } = supabase.storage
    .from(storageBucket)
    .getPublicUrl(storagePath)

  console.log(`PDF uploaded: ${publicUrl}`)
  return publicUrl
}

// Step 2: Scrape PDF (extract text using Python service)
async function scrapePdf(pdfUrl: string): Promise<string> {
  console.log('\nStep 2: Extracting text from PDF...')
  
  try {
    const response = await fetch(PYTHON_SCRAPER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: [pdfUrl] }),
    })

    if (!response.ok) {
      throw new Error(`Scraper service failed: ${response.status} ${response.statusText}`)
    }

    const results = await response.json() as Array<{ data?: unknown; text?: string; form_type?: string }>
    
    if (!results || !results[0]) {
      throw new Error('No results returned from scraper service')
    }

    const result = results[0]
    const extractedText = result.data ? JSON.stringify(result.data) : result.text || ''
    
    console.log(`Text extracted: ${extractedText.length} characters`)
    if (result.form_type) {
      console.log(`Form type detected: ${result.form_type}`)
    }
    
    return extractedText
  } catch (error) {
    console.error('Scraper service error:', error)
    throw new Error(`Failed to scrape PDF: ${error instanceof Error ? error.message : String(error)}`)
  }
}

// Step 3: Create embeddings
async function createEmbeddingsForText(
  text: string,
  uploadedDocumentId: string,
  grantId?: string,
  userId?: string
): Promise<void> {
  console.log('\nStep 3: Creating embeddings...')
  
  try {
    // Chunk the text if it's too long (embedding models have token limits)
    // For now, we'll send the full text, but you might want to chunk it
    const maxChunkSize = 8000 // Adjust based on your embedding model
    const chunks: string[] = []
    
    if (text.length > maxChunkSize) {
      // Simple chunking by sentences (you might want more sophisticated chunking)
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]
      let currentChunk = ''
      
      for (const sentence of sentences) {
        if ((currentChunk + sentence).length > maxChunkSize && currentChunk) {
          chunks.push(currentChunk)
          currentChunk = sentence
        } else {
          currentChunk += sentence
        }
      }
      if (currentChunk) chunks.push(currentChunk)
    } else {
      chunks.push(text)
    }

    console.log(`Creating embeddings for ${chunks.length} chunk(s)...`)

    // Create embeddings for each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      
      const response = await fetch(PYTHON_EMBED_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: chunk }),
      })

      if (!response.ok) {
        throw new Error(`Embedding service failed: ${response.status}`)
      }

      const result = await response.json() as EmbeddingResponse

      if (!result.embedding || !Array.isArray(result.embedding)) {
        throw new Error('Invalid embedding response')
      }

      // Store embedding
      const { error: embedError } = await supabase
        .from('document_embeddings')
        .insert({
          content: chunk,
          embedding: result.embedding,
          uploaded_document_id: uploadedDocumentId,
          grant_id: grantId || null,
          user_id: userId || null,
          created_at: new Date().toISOString(),
        })

      if (embedError) {
        throw new Error(`Failed to store embedding: ${embedError.message}`)
      }

      console.log(`Embedding ${i + 1}/${chunks.length} created`)
    }

    console.log(`All embeddings created and stored`)
  } catch (error) {
    console.error('Failed to create embeddings:', error)
    throw error
  }
}

// Step 4: Create or get grant record
async function createOrGetGrant(
  organizationName?: string,
  grantorName?: string,
  fundingAmount?: number
): Promise<string> {
  console.log('\nStep 4: Setting up grant record...')

  // For testing, create a simple grant record
  const { data: grant, error: grantError } = await supabase
    .from('grants')
    .insert({
      nonprofit_name: organizationName || 'Test Organization',
      grantor_name: grantorName || 'Test Grantor',
      funding_amount: fundingAmount || null,
      proposal_type: 'test',
    })
    .select('id')
    .single()

  if (grantError) {
    // If grant already exists or other error, try to get existing
    console.warn('Could not create grant, using existing or default')
    // For simplicity, we'll just generate a UUID or use a default
    // In production, you'd want better error handling
    throw new Error(`Failed to create grant: ${grantError.message}`)
  }

  console.log(`Grant record created: ${grant.id}`)
  return grant.id
}

// Step 5: Generate grant sections (RAG pipeline)
async function generateGrantSections(
  grantId: string,
  sections: GenerationSectionName[],
  query: string
): Promise<void> {
  console.log('\nStep 5: Generating grant sections using RAG pipeline...')
  console.log(`Sections: ${sections.join(', ')}`)
  console.log(`Query: ${query}\n`)

  const llm = new callDebate(process.env)

  const deps: GenerationDependencies = {
    supabase,
    llm,
    now: () => new Date(),
    logger: {
      debug: (msg, meta) => console.log(`[DEBUG] ${msg}`, meta),
      info: (msg, meta) => console.log(`[INFO] ${msg}`, meta),
      warn: (msg, meta) => console.warn(`[WARN] ${msg}`, meta),
      error: (msg, meta) => console.error(`[ERROR] ${msg}`, meta),
    },
  }

  // Fetch context (RAG retrieval)
  console.log('Fetching context from embeddings...')
  const context = await fetchGrantContext(deps, {
    grantId,
    query,
    maxChunks: 20,
  })

  if (context.warnings.length > 0) {
    console.warn('Warnings:')
    context.warnings.forEach(warning => console.warn(`- ${warning}`))
  }

  console.log(`Found ${context.chunks.length} context chunks`)

  // Generate sections
  console.log('Generating sections...')
  const startTime = Date.now()
  
  const result = await llm.generateAll({
    grant: context.grant,
    chunks: context.chunks,
    sections,
  })

  const generationTime = Date.now() - startTime
  console.log(`Generation completed in ${generationTime}ms\n`)

  // Print results
  console.log('\n' + '═'.repeat(80))
  console.log('  GENERATED GRANT PROPOSAL')
  console.log('═'.repeat(80))

  function formatSectionName(section: GenerationSectionName): string {
    return section
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  for (const section of sections) {
    const sectionContent = result.sections[section]?.content
    if (sectionContent) {
      const formattedName = formatSectionName(section)
      console.log('\n' + '='.repeat(80))
      console.log(`  ${formattedName}`)
      console.log('='.repeat(80))
      console.log(sectionContent)
      console.log('='.repeat(80) + '\n')
    } else {
      console.warn(`\nSection "${section}" was not generated\n`)
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(80))
  console.log('  SUMMARY')
  console.log('═'.repeat(80))
  console.log(`Total sections: ${sections.length}`)
  console.log(`Generation time: ${generationTime}ms`)
  console.log(`Context chunks used: ${context.chunks.length}`)
  console.log('═'.repeat(80) + '\n')
}

// Main function
export async function testGen(): Promise<void> {
  console.log('\nGrant Generation Test Pipeline')
  console.log('═'.repeat(80))

  try {
    // Use sample_pdf.pdf from project root
    const filePath = path.join(process.cwd(), 'sample_pdf.pdf')
    console.log(`\nUsing PDF: ${filePath}`)
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`PDF file not found: ${filePath}`)
    }

    // Step 1: Upload PDF
    const pdfUrl = await uploadPdfToStorage(filePath)

    // Step 2: Scrape PDF
    const extractedText = await scrapePdf(pdfUrl)

    // Step 3: Create document record
    console.log('\nStep 3: Creating document record...')
    const { data: document, error: docError } = await supabase
      .from('uploaded_documents')
      .insert({
        file_name: path.basename(filePath),
        file_url: pdfUrl,
        file_type: 'test',
        extracted_text: extractedText,
      })
      .select('id')
      .single()

    if (docError) {
      throw new Error(`Failed to create document record: ${docError.message}`)
    }

    const documentId = document.id
    console.log(`Document record created: ${documentId}`)

    // Step 4: Create embeddings
    const grantId = await createOrGetGrant()
    await createEmbeddingsForText(extractedText, documentId, grantId)

    // Update document with grant_id
    await supabase
      .from('uploaded_documents')
      .update({ grant_id: grantId })
      .eq('id', documentId)

    // Step 5: Get query from user
    const query = await promptUser('\nEnter query for grant generation (e.g., "robotics program grant"): ') || 'grant proposal'

    // Step 6: Generate grant sections
    await generateGrantSections(grantId, DEFAULT_SECTIONS, query)

    console.log('Test generation completed successfully!')
    console.log(`\nGrant ID: ${grantId}`)
    console.log(`Document ID: ${documentId}\n`)

  } catch (error) {
    console.error('\nError during test generation:')
    console.error(error instanceof Error ? error.message : String(error))
    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:')
      console.error(error.stack)
    }
    throw error
  }
}

// CLI entry point
// Check if this file is being run directly (not imported)
const isMainModule = import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('test_gen.ts')
if (isMainModule) {
  testGen()
    .then(() => {
      process.exit(0)
    })
    .catch(error => {
      console.error('Test generation failed:', error)
      process.exit(1)
    })
}
