import type {
  GenerationDependencies,
  GenerationSectionName,
  LLMGenerationResult,
} from './types'

interface PersistSectionParams {
  deps: GenerationDependencies
  grantId: string
  section: GenerationSectionName
  content: string
  tokens?: LLMGenerationResult['tokens']
  contextRefs: string[]
  promptWarnings: string[]
  llmWarnings: string[]
  timing: {
    startedAt: Date
    completedAt: Date
    retrievalMs: number
    generationMs: number
  }
  llmRaw?: unknown
}

interface PersistSectionResult {
  sectionId: string | null
  warnings: string[]
}

export async function persistSection({
  deps,
  grantId,
  section,
  content,
  tokens,
  contextRefs,
  promptWarnings,
  llmWarnings,
  timing,
  llmRaw,
}: PersistSectionParams): Promise<PersistSectionResult> {
  const warnings: string[] = []
  const { supabase, logger } = deps

  if (!supabase) {
    warnings.push('Supabase client not available; skipping persistence.')
    return { sectionId: null, warnings }
  }

  const { data: sectionInsert, error: sectionError } = await supabase
    .from('proposal_sections')
    .insert({
      grant_id: grantId,
      section_name: section,
      content,
      tokens_used: tokens?.total ?? null,
      model_used: llmRaw && typeof llmRaw === 'object' && 'model' in (llmRaw as Record<string, unknown>)
        ? String((llmRaw as Record<string, unknown>).model)
        : null,
    })
    .select('id')
    .single()

  if (sectionError) {
    warnings.push('Failed to persist proposal section.')
    logger?.error('persistSection: proposal insert failed', { grantId, section, sectionError, promptWarnings, llmWarnings })
  }

  const { error: logError } = await supabase
    .from('generation_logs')
    .insert({
      grant_id: grantId,
      section_name: section,
      retrieval_time_ms: Math.round(timing.retrievalMs),
      generation_time_ms: Math.round(timing.generationMs),
      context_sources: contextRefs.map((id) => ({ id })),
      hallucination_score: null,
    })

  if (logError) {
    warnings.push('Failed to persist generation log.')
    logger?.warn('persistSection: log insert failed', { grantId, section, logError })
  }

  return {
    sectionId: sectionInsert?.id ?? null,
    warnings,
  }
}
