import type { PostgrestError } from '@supabase/supabase-js'
import type {
  GenerationContext,
  GenerationDependencies,
  GenerationOverrides,
  GenerationContextChunk,
} from './types'
import { embedQuery } from "../embed.ts"

interface FetchGrantContextParams {
  grantId: string
  overrides?: GenerationOverrides
  maxChunks?: number
  query: string
}

function mapEmbeddingToChunk(row: {
  id: string
  content: string | null
  similarity?: number
  uploaded_document_id?: string | null
}): GenerationContextChunk | null {
  if (!row.content) return null
  return {
    id: row.id,
    content: row.content,
    // source type is all just uploaded for now
    source_type: 'uploaded',
    source_ref: row.uploaded_document_id ?? undefined,
  }
}

function normalizeOverrideChunks(overrides?: GenerationOverrides): GenerationContextChunk[] {
  if (!overrides?.context_chunks?.length) return []
  return overrides.context_chunks.map((chunk, idx) => ({
    id: chunk.id || `override-${idx}`,
    content: chunk.content,
    source_type: chunk.source_type ?? 'override',
    source_ref: chunk.source_ref,
    relevance_score: chunk.relevance_score,
  }))
}

export async function fetchGrantContext(
  deps: GenerationDependencies,
  params: FetchGrantContextParams,
): Promise<GenerationContext> {
  const warnings: string[] = []
  const { supabase, logger } = deps
  const { grantId, overrides, maxChunks = 20 } = params

  if (!supabase) {
    warnings.push('Supabase client not provided; returning override context only.')
    return {
      grant: null,
      chunks: normalizeOverrideChunks(overrides),
      warnings,
    }
  }

  const { data: grant, error: grantError } = await supabase
    .from('grants')
    .select(
      `id,
       nonprofit_name,
       grantor_name,
       funding_amount,
       proposal_type`,
    )
    .eq('id', grantId)
    .maybeSingle()

  if (grantError && !isNoRowsError(grantError)) {
    warnings.push('Failed to load grant metadata.')
    logger?.error('fetchGrantContext: grant query failed', { grantId, grantError })
  }

  const queryEmbedding = await embedQuery(params.query);

  // changed the pulling embeddings from database logic to have it use the match function in supabse
  const { data: matches, error: embeddingsError } = await supabase.rpc('match_documents',
    {
      query_embedding: queryEmbedding,
      match_count: maxChunks,
      filter_grant_id: grantId || null
    }
  )

  if (embeddingsError && !isNoRowsError(embeddingsError)) {
    warnings.push('Failed to load context chunks.')
    logger?.error('fetchGrantContext: embedding query failed', { grantId, embeddingsError })
  }

  const chunkList: GenerationContextChunk[] = []
  matches?.forEach((row) => {
    const chunk = mapEmbeddingToChunk(row)
    if (chunk) chunkList.push(chunk)
  })

  const overrideChunks = normalizeOverrideChunks(overrides)
  if (overrideChunks.length) {
    warnings.push('Using override context chunks (development mode).')
    chunkList.unshift(...overrideChunks)
  }

  if (!chunkList.length) {
    warnings.push('No context chunks available for this grant.')
  }

  return {
    grant: grant || null,
    chunks: chunkList,
    warnings,
  }
}

function isNoRowsError(error: PostgrestError): boolean {
  return error.code === 'PGRST116' || error.details?.includes('Results contain 0 rows')
}