import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../database.types'
import { fetchGrantContext } from './services/fetchGrantContext'
import { callDebate } from './services/callDebate'
import type {
  GenerationDependencies,
  GenerationSectionName,
} from './services/types'

// Default sections to generate
const DEFAULT_SECTIONS: GenerationSectionName[] = [
  'executive_summary',
  'needs_statement',
  'program_description',
  'budget_overview',
]

interface SimulateParams {
  grantId: string
  sections?: GenerationSectionName[]
  query?: string
}

function formatSectionName(section: GenerationSectionName): string {
  return section
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function printSection(sectionName: GenerationSectionName, content: string) {
  const formattedName = formatSectionName(sectionName)
  console.log('\n' + '='.repeat(80))
  console.log(`  ${formattedName}`)
  console.log('='.repeat(80))
  console.log(content)
  console.log('='.repeat(80) + '\n')
}

export async function simulateGrant({
  grantId,
  sections = DEFAULT_SECTIONS,
  query = 'grant proposal',
}: SimulateParams): Promise<void> {
  console.log('\nStarting Grant Generation Simulation')
  console.log(`Grant ID: ${grantId}`)
  console.log(`Sections to generate: ${sections.join(', ')}`)
  console.log(`Query: ${query}\n`)

  // Setup dependencies
  const supabase = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

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

  try {
    // Step 1: Fetch context
    console.log('Fetching grant context...')
    const context = await fetchGrantContext(deps, {
      grantId,
      query,
      maxChunks: 20,
    })

    if (context.warnings.length > 0) {
      console.warn('Warnings during context fetch:')
      context.warnings.forEach(warning => console.warn(`- ${warning}`))
    }

    console.log(`Found ${context.chunks.length} context chunks`)
    if (context.grant) {
      console.log(`Grantor: ${context.grant.grantor_name || 'N/A'}`)
      console.log(`Funding: $${context.grant.funding_amount || 'N/A'}`)
    }

    // Step 2: Generate all sections
    console.log('\nGenerating sections with LLM...')
    const startTime = Date.now()
    
    const result = await llm.generateAll({
      grant: context.grant,
      chunks: context.chunks,
      sections,
    })

    const generationTime = Date.now() - startTime
    console.log(`Generation completed in ${generationTime}ms`)

    if (result.warnings.length > 0) {
      console.warn('\nGeneration warnings:')
      result.warnings.forEach(warning => console.warn(`- ${warning}`))
    }

    // Step 3: Print all sections
    console.log('\n' + '═'.repeat(80))
    console.log('  GENERATED GRANT PROPOSAL')
    console.log('═'.repeat(80))

    for (const section of sections) {
      const sectionContent = result.sections[section]?.content
      if (sectionContent) {
        printSection(section, sectionContent)
      } else {
        console.warn(`\nSection "${section}" was not generated\n`)
      }
    }

    // Print summary
    console.log('\n' + '═'.repeat(80))
    console.log('  SUMMARY')
    console.log('═'.repeat(80))
    console.log(`Total sections generated: ${sections.length}`)
    console.log(`Generation time: ${generationTime}ms`)
    console.log(`Context chunks used: ${context.chunks.length}`)
    
    if (result.warnings.length > 0) {
      console.log(`Warnings: ${result.warnings.length}`)
    }
    console.log('═'.repeat(80) + '\n')

  } catch (error) {
    console.error('\nError during simulation:')
    console.error(error instanceof Error ? error.message : String(error))
    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:')
      console.error(error.stack)
    }
    throw error
  }
}

// CLI entry point
if (require.main === module) {
  const grantId = process.argv[2]
  const sectionsArg = process.argv[3]
  const queryArg = process.argv[4]

  if (!grantId) {
    console.error('Usage: ts-node simulate.ts <grantId> [sections] [query]')
    console.error('Example: ts-node simulate.ts abc-123 "executive_summary,needs_statement" "robotics program"')
    process.exit(1)
  }

  const sections = sectionsArg
    ? (sectionsArg.split(',') as GenerationSectionName[])
    : undefined

  simulateGrant({
    grantId,
    sections,
    query: queryArg,
  })
    .then(() => {
      console.log('Simulation completed successfully')
      process.exit(0)
    })
    .catch(error => {
      console.error('Simulation failed:', error)
      process.exit(1)
    })
}
