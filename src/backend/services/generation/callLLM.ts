import type {
  GenerationDependencies,
  GenerationSectionName,
  LLMGenerationResult,
} from './types'

interface CallLLMParams {
  deps: GenerationDependencies
  prompt: string
  section: GenerationSectionName
}

interface CallLLMResult {
  result: LLMGenerationResult
  warnings: string[]
}

const STUB_RESPONSE: LLMGenerationResult = {
  content:
    '[Stubbed response] The LLM client has not been configured. Please supply overrides.llm to generate real content.',
}

export async function callLLM({ deps, prompt, section }: CallLLMParams): Promise<CallLLMResult> {
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
    const result = await llm.generate({ prompt, section })
    return { result, warnings }
  } catch (error) {
    logger?.error('callLLM: generation failed', { section, error })
    warnings.push('LLM call failed; returning stubbed content.')
    return {
      result: STUB_RESPONSE,
      warnings,
    }
  }
}
