import { fetchGrantContext } from './fetchGrantContext'
import { buildPrompt } from './buildPrompt'
import { callLLM } from './callLLM'
import { persistSection } from './persistSection'
import type {
  GenerationDependencies,
  GenerationOverrides,
  GenerationResult,
  GenerationSectionName,
} from './types'

interface GenerateSectionParams {
  deps: GenerationDependencies
  grantId: string
  section: GenerationSectionName
  overrides?: GenerationOverrides
}

const nowHighRes = () =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()

export async function generateSection({
  deps,
  grantId,
  section,
  overrides,
}: GenerateSectionParams): Promise<GenerationResult> {
  const startedAt = deps.now ? deps.now() : new Date()
  const warnings: string[] = []

  try {
    const contextStart = nowHighRes()
    const context = await fetchGrantContext(deps, {
      grantId,
      overrides,
    })
    const contextEnd = nowHighRes()

    warnings.push(...context.warnings)

    const { prompt, usedChunkIds, warnings: promptWarnings } = buildPrompt({ context, section })
    warnings.push(...promptWarnings)

    const llmStart = nowHighRes()
    const { result: llmResult, warnings: llmWarnings } = await callLLM({
      deps,
      prompt,
      section,
    })
    const llmEnd = nowHighRes()
    warnings.push(...llmWarnings)

    const content = llmResult.content ?? ''
    const generationCompletedAt = deps.now ? deps.now() : new Date()

    const { warnings: persistenceWarnings } = await persistSection({
      deps,
      grantId,
      section,
      content,
      tokens: llmResult.tokens,
      contextRefs: usedChunkIds,
      promptWarnings,
      llmWarnings,
      timing: {
        startedAt,
        completedAt: generationCompletedAt,
        retrievalMs: contextEnd - contextStart,
        generationMs: llmEnd - llmStart,
      },
      llmRaw: llmResult.raw,
    })
    warnings.push(...persistenceWarnings)

    return {
      name: section,
      status: 'success',
      content,
      tokens_used: llmResult.tokens ?? null,
      context_refs: usedChunkIds,
      warnings,
      error: null,
      meta: buildMeta(startedAt, generationCompletedAt),
    }
  } catch (error) {
    deps.logger?.error('generateSection: fatal error', { grantId, section, error })
    const completedAt = deps.now ? deps.now() : new Date()

    return {
      name: section,
      status: 'error',
      content: null,
      tokens_used: null,
      context_refs: [],
      warnings,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        type: error instanceof Error ? error.name : 'UnknownError',
      },
      meta: buildMeta(startedAt, completedAt),
    }
  }
}

function buildMeta(startedAt: Date, completedAt: Date) {
  const durationMs = completedAt.getTime() - startedAt.getTime()
  return {
    started_at: startedAt.toISOString(),
    completed_at: completedAt.toISOString(),
    duration_ms: durationMs,
  }
}