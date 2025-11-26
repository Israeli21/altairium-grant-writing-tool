import type {
  GenerationContext,
  GenerationSectionName,
  GenerationContextChunk,
} from './types'

interface BuildPromptParams {
  context: GenerationContext
  section: GenerationSectionName
}

export interface BuildPromptResult {
  prompt: string
  usedChunkIds: string[]
  warnings: string[]
}

const SECTION_DESCRIPTIONS: Record<GenerationSectionName, string> = {
  executive_summary:
    'Write a concise executive summary highlighting the organization, funding request, and intended impact.',
  needs_statement:
    'Describe the community problem or need, include relevant data, and explain why the organization is well positioned to address it.',
  program_description:
    'Detail the proposed program, including goals, activities, beneficiaries, and success measures.',
  budget_overview:
    'Summarize the funding request, including budget categories and how resources will be allocated.',
  custom: 'Draft the requested grant section using the provided context.',
}

export function buildPrompt({ context, section }: BuildPromptParams): BuildPromptResult {
  const warnings = [...context.warnings]
  const grant = context.grant
  const chunks = context.chunks

  const headerLines: string[] = [
    'You are a grant-writing assistant. Produce clear, factual prose grounded in the supplied context. Cite source IDs inline where appropriate.',
  ]

  if (grant) {
    headerLines.push('Grant metadata:')
    headerLines.push(`- Organization: ${grant.organization_name ?? 'N/A'}`)
    headerLines.push(`- Project title: ${grant.project_title ?? 'N/A'}`)
    headerLines.push(`- Grantor: ${grant.grantor_name ?? 'N/A'}`)
    headerLines.push(`- Funding amount: ${grant.funding_amount ?? 'N/A'}`)
    if (grant.project_description) {
      headerLines.push(`- Project description: ${grant.project_description}`)
    }
  } else {
    warnings.push('Grant metadata unavailable; prompt will rely solely on context chunks.')
  }

  const chunkLines = renderChunks(chunks)
  if (!chunkLines.length) {
    warnings.push('Prompt will be generated without supporting context chunks.')
  }

  const prompt = [
    headerLines.join('\n'),
    '',
    `Task: ${SECTION_DESCRIPTIONS[section]}`,
    '',
    'Context: ',
    chunkLines.join('\n'),
    '',
    'Deliverable: Write the requested section in 3-5 paragraphs. Stay truthful to the context. If missing information, state the gap instead of guessing.',
  ].join('\n')

  return {
    prompt,
    usedChunkIds: chunks.map((chunk) => chunk.id),
    warnings,
  }
}

function renderChunks(chunks: GenerationContextChunk[]): string[] {
  return chunks.map((chunk, index) => {
    const ref = chunk.source_ref ? ` (${chunk.source_ref})` : ''
    const score = typeof chunk.relevance_score === 'number' ? ` [score: ${chunk.relevance_score.toFixed(3)}]` : ''
    return `Chunk ${index + 1} [${chunk.id}${ref}]${score}:\n${chunk.content}`
  })
}