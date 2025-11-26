import type {
  LLMClient,
  GenerationSectionName,
  LLMGenerationResult,
} from "./types.ts"

import { buildPrompt } from "./buildPrompt.ts"

interface FullProposalResult {
  sections: Record<GenerationSectionName, LLMGenerationResult>;
  warnings: string[];
}

export class callDebate implements LLMClient {
  private geminiKey1: string
  private geminiKey2: string
  private claudeKey: string

  constructor(env: NodeJS.ProcessEnv) {
    this.geminiKey1 = env.GEMINI_PROPOSER_KEY!
    this.geminiKey2 = env.GEMINI_CHALLENGER_KEY!
    this.claudeKey = env.CLAUDE_REFEREE_KEY!
  }

  /**
   * Generate ALL sections — looping happens HERE.
   */
  async generateAll({
    grant,
    chunks,
    sections,
  }: {
    grant: any;
    chunks: any[];
    sections: GenerationSectionName[];
  }): Promise<FullProposalResult> {
    const warnings: string[] = [];
    const results: Record<GenerationSectionName, LLMGenerationResult> = {} as any;

    for (const section of sections) {
      // 1. Build section-specific prompt
      const prompt = buildPrompt({
        section,
        grant,
        chunks,
      });

      // 2. Run full proposer → challenger → referee pipeline
      const result = await this.runDebateRound(prompt, section);

      results[section] = result;
    }

    return {
      sections: results,
      warnings,
    };
  }

  /**
   * OLD single-section entrypoint (still works if needed)
   */
  async generate({
    prompt,
    section,
  }: {
    prompt: string;
    section: GenerationSectionName;
  }): Promise<LLMGenerationResult> {
    return this.runDebateRound(prompt, section);
  }

  /**
   * One full debate cycle:
   * Gemini (Proposer) → Gemini (Challenger) → Claude (Referee)
   */
  private async runDebateRound(
    prompt: string,
    section: GenerationSectionName
  ): Promise<LLMGenerationResult> {
    const proposerOutput = await this.callGemini(
      this.geminiKey1,
      `You are PROPOSER for ${section}:\n${prompt}`
    );

    const challengerOutput = await this.callGemini(
      this.geminiKey2,
      `You are CHALLENGER for ${section}.\nProposer wrote:\n${proposerOutput}\nImprove it while keeping fidelity to the prompt:\n${prompt}`
    );

    const finalOutput = await this.callClaude(
      this.claudeKey,
      `
You are the REFEREE for ${section}.
Combine the strengths of both answers and produce the best final version.

PROPOSER:
${proposerOutput}

CHALLENGER:
${challengerOutput}

PROMPT:
${prompt}
`
    );

    return {
      content: finalOutput,
      tokens: 0,
      raw: {
        proposer: proposerOutput,
        challenger: challengerOutput,
        referee: finalOutput,
      },
    };
  }

  private async callGemini(key: string, text: string): Promise<string> {
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateText",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          prompt: { text },
        }),
      }
    );

    const data = await res.json();
    return data?.candidates?.[0]?.output_text ?? "";
  }

  private async callClaude(key: string, prompt: string): Promise<string> {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": key,
      },
      body: JSON.stringify({
        model: "claude-3-sonnet-20240229",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await res.json();
    return data?.content?.[0]?.text ?? "";
  }
}
 