// backend/orchestrator/generateGrant.ts
// Modular grant generation using services pipeline

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../database.types';
import { fetchGrantContext } from './services/fetchGrantContext';
import { callDebate } from './services/callDebate';
import type {
  GenerationDependencies,
  GenerationSectionName,
  GenerationContextChunk,
} from './services/types';

// ---------- Supabase Client ----------

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ---------- Types ----------

export interface GenerateGrantInput {
  userRequest: string;           // "Write a grant for our robotics program..."
  grantId?: string;              // Optional: existing grant ID for context
  nonprofitId?: string;          // Filter documents by org
  matchCount?: number;           // How many RAG chunks to pull
  sections?: GenerationSectionName[]; // Which sections to generate
}

export interface GenerateGrantResult {
  finalGrant: string;
  sections: {
    executive_summary?: string;
    needs_statement?: string;
    program_description?: string;
    budget_overview?: string;
  };
  contextChunks: GenerationContextChunk[];
  warnings: string[];
}

// ---------- Default Sections ----------

const DEFAULT_SECTIONS: GenerationSectionName[] = [
  'executive_summary',
  'needs_statement',
  'program_description',
  'budget_overview',
];

// ---------- Logger ----------

const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => console.log(`[DEBUG] ${msg}`, meta || ''),
  info: (msg: string, meta?: Record<string, unknown>) => console.log(`[INFO] ${msg}`, meta || ''),
  warn: (msg: string, meta?: Record<string, unknown>) => console.warn(`[WARN] ${msg}`, meta || ''),
  error: (msg: string, meta?: Record<string, unknown>) => console.error(`[ERROR] ${msg}`, meta || ''),
};

// ---------- Main Orchestrator ----------

export async function generateGrant(input: GenerateGrantInput): Promise<GenerateGrantResult> {
  const { 
    userRequest, 
    grantId,
    matchCount = 10,
    sections = DEFAULT_SECTIONS 
  } = input;

  const warnings: string[] = [];

  console.log('═'.repeat(60));
  console.log('  GRANT GENERATION PIPELINE');
  console.log('═'.repeat(60));

  // Step 1: Create or use existing grant record
  console.log('\nStep 1: Setting up grant context...');
  
  let activeGrantId = grantId;
  
  if (!activeGrantId) {
    // Create a temporary grant record for this generation
    const { data: newGrant, error: grantError } = await supabase
      .from('grants')
      .insert({
        nonprofit_name: input.nonprofitId || 'Grant Application',
        proposal_type: 'generated',
      })
      .select('id')
      .single();

    if (grantError) {
      warnings.push(`Could not create grant record: ${grantError.message}`);
      logger.warn('Failed to create grant record', { error: grantError });
    } else {
      activeGrantId = newGrant.id;
      console.log(`Created grant record: ${activeGrantId}`);
    }
  }

  // Step 2: Initialize LLM client (using OpenAI via callDebate)
  console.log('\nInitializing LLM client...');
  const llm = new callDebate(process.env);
  console.log('Using OpenAI (gpt-4.1-mini)');

  // Step 3: Set up dependencies
  const deps: GenerationDependencies = {
    supabase,
    llm,
    now: () => new Date(),
    logger,
  };

  // Step 4: Fetch context using RAG
  console.log('\nFetching context via RAG...');
  
  let context;
  try {
    context = await fetchGrantContext(deps, {
      grantId: activeGrantId || '',
      query: userRequest,
      maxChunks: matchCount,
    });
    
    console.log(`Found ${context.chunks.length} context chunks`);
    
    if (context.warnings.length > 0) {
      warnings.push(...context.warnings);
      context.warnings.forEach(w => console.log(`   (WARNING)  ${w}`));
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    warnings.push(`Context retrieval failed: ${errorMsg}`);
    logger.error('Failed to fetch context', { error });
    
    // Continue with empty context
    context = {
      grant: null,
      chunks: [],
      warnings: [`Context retrieval failed: ${errorMsg}`],
    };
  }

  // Step 5: Generate all sections
  console.log('\nGenerating grant sections...');
  console.log(`   Sections: ${sections.join(', ')}`);

  const startTime = Date.now();
  
  const result = await llm.generateAll({
    grant: context.grant,
    chunks: context.chunks,
    sections,
  });

  const generationTime = Date.now() - startTime;
  console.log(`Generation completed in ${generationTime}ms`);

  if (result.warnings.length > 0) {
    warnings.push(...result.warnings);
  }

  // Step 6: Assemble final grant document
  console.log('\nAssembling final grant document...');

  const sectionContents: GenerateGrantResult['sections'] = {};
  const sectionOrder: GenerationSectionName[] = [
    'executive_summary',
    'needs_statement', 
    'program_description',
    'budget_overview',
  ];

  // Extract section contents
  for (const section of sectionOrder) {
    if (section === 'custom') continue; // Skip custom sections in standard assembly
    const sectionResult = result.sections[section];
    if (sectionResult?.content) {
      sectionContents[section as keyof typeof sectionContents] = sectionResult.content;
    }
  }

  // Combine sections into final grant
  const finalGrant = assembleFinalGrant(sectionContents);

  console.log('\n' + '═'.repeat(60));
  console.log('  GENERATION COMPLETE');
  console.log('═'.repeat(60));
  console.log(`  Sections generated: ${Object.keys(sectionContents).length}`);
  console.log(`  Context chunks used: ${context.chunks.length}`);
  console.log(`  Total time: ${generationTime}ms`);
  console.log(`  Warnings: ${warnings.length}`);
  console.log('═'.repeat(60) + '\n');

  return {
    finalGrant,
    sections: sectionContents,
    contextChunks: context.chunks,
    warnings,
  };
}

// ---------- Helper: Assemble Final Grant Document ----------

function assembleFinalGrant(
  sections: GenerateGrantResult['sections']
): string {
  const parts: string[] = [];

  parts.push('═'.repeat(60));
  parts.push('GRANT PROPOSAL');
  parts.push('═'.repeat(60));
  parts.push('');

  if (sections.executive_summary) {
    parts.push('EXECUTIVE SUMMARY');
    parts.push('─'.repeat(40));
    parts.push(sections.executive_summary);
    parts.push('');
  }

  if (sections.needs_statement) {
    parts.push('STATEMENT OF NEED');
    parts.push('─'.repeat(40));
    parts.push(sections.needs_statement);
    parts.push('');
  }

  if (sections.program_description) {
    parts.push('PROGRAM DESCRIPTION');
    parts.push('─'.repeat(40));
    parts.push(sections.program_description);
    parts.push('');
  }

  if (sections.budget_overview) {
    parts.push('BUDGET OVERVIEW');
    parts.push('─'.repeat(40));
    parts.push(sections.budget_overview);
    parts.push('');
  }

  parts.push('═'.repeat(60));

  return parts.join('\n');
}
