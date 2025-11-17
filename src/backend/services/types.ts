import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../../database.types'

export type GenerationSectionName =
  | 'executive_summary'
  | 'needs_statement'
  | 'program_description'
  | 'budget_overview'
  | 'custom'

export interface GenerationOverrides {
  context_chunks?: GenerationContextChunk[]
}

export interface GenerationRequestPayload {
  grantId: string
  section: GenerationSectionName
  overrides?: GenerationOverrides
}

export interface GenerationContextChunk {
  id: string
  content: string
  source_type: 'uploaded' | 'scraped' | 'override' | string
  source_ref?: string
  relevance_score?: number
}

export interface GrantMetadata {
  id: string
  organization_name?: string | null
  project_title?: string | null
  grantor_name?: string | null
  funding_amount?: number | null
  project_description?: string | null
  grant_opportunity_url?: string | null
  structure_type?: string | null
}

export interface GenerationContext {
  grant: GrantMetadata | null
  chunks: GenerationContextChunk[]
  warnings: string[]
}

export interface GenerationDependencies {
  supabase?: SupabaseClient<Database>
  llm?: LLMClient
  now?: () => Date
  logger?: {
    debug: (message: string, meta?: Record<string, unknown>) => void
    info: (message: string, meta?: Record<string, unknown>) => void
    warn: (message: string, meta?: Record<string, unknown>) => void
    error: (message: string, meta?: Record<string, unknown>) => void
  }
}

export interface FullProposalResult {
    sections: Record<GenerationSectionName, LLMGenerationResult>;
    warnings: string[];
}

export interface LLMClient {
  generateAll: (input: {
    grant: any
    chunks: GenerationContextChunk[]
    sections: GenerationSectionName[]
  }) => Promise<FullProposalResult>
}

export interface LLMGenerationResult {
  content: string
  tokens?: {
    prompt: number
    completion: number
    total: number
  }
  raw?: unknown
}

export interface GenerationResult {
  name: GenerationSectionName
  status: 'success' | 'skipped' | 'error'
  content: string | null
  tokens_used: LLMGenerationResult['tokens'] | null
  context_refs: string[]
  warnings: string[]
  error: null | {
    message: string
    type: string
  }
  meta: {
    started_at: string
    completed_at: string
    duration_ms: number
  }
}