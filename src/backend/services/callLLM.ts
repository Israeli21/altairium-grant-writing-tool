import type {
  GenerationDependencies,
  GenerationSectionName,
  LLMGenerationResult,
} from './types'

import type { GenerationContextChunk } from './types.ts'

interface CallLLMParams {
  deps: GenerationDependencies
  prompt: string
  section: GenerationSectionName
  grant: any
  chunks: GenerationContextChunk[]
}

interface CallLLMResult {
  result: LLMGenerationResult
  warnings: string[]
}

const STUB_RESPONSE: LLMGenerationResult = {
  content:
    '[Stubbed response] The LLM client has not been configured. Please supply overrides.llm to generate real content.',
}

export async function callLLM({ deps, prompt, section, grant, chunks }: CallLLMParams): Promise<CallLLMResult> {
  const warnings: string[] = []
  const { llm, logger } = deps

  if (!llm) {
    warnings.push('LLM client not configured; returning stubbed content.')
    return {
      result: STUB_RESPONSE,
      warnings,
    }
  }

  try {
    // Building prompt result object for each section
    const promptResult = {prompt, usedChunkIds: chunks.map((chunk) => chunk.id), warnings: []}

    // Generating all sections
    const result = await llm.generateAll({grant, chunks, sections: [section]})

    // Returning result
    return { result: result.sections[section], warnings }
  } catch (error) {
    logger?.error('callLLM: generation failed', { section, error })
    warnings.push('LLM call failed; returning stubbed content.')
    return {
      result: STUB_RESPONSE,
      warnings,
    }
  }
}