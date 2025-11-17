// Importing needed types

import type{
    LLMClient,
    GenerationSectionName,
    LLMGenerationResult,
    GenerationContextChunk,
    GenerationContext,
    FullProposalResult
} from "./types.ts"

// Importing needed functions

import { buildPrompt, BuildPromptResult } from "./buildPrompt.ts";




// Debate function using Gemini and Claude
export class callDebate implements LLMClient{
    private geminiKey1: string
    private geminiKey2: string
    private claudeKey: string
    private openAIKey: string

    constructor(env: NodeJS.ProcessEnv){
        this.geminiKey1 = env.GEMINI_PROPOSER_KEY ?? ""
        this.geminiKey2 = env.GEMINI_CHALLENGER_KEY ?? ""
        this.claudeKey = env.CLAUDE_REFEREE_KEY ?? ""
        this.openAIKey = env.OPENAI_KEY ?? ""
    }

    // Function to generate all sections
    async generateAll({grant, chunks, sections} : {grant: any, chunks: GenerationContextChunk[], sections: GenerationSectionName[]}): Promise<FullProposalResult>{
        const warnings: string[] = [];
        const results: Record<GenerationSectionName, LLMGenerationResult> = {} as any;
        const context: GenerationContext = {grant, chunks, warnings}
        for (const section of sections){
            // Building prompt for each section
            const prompt = buildPrompt({context, section});

            // Run full debate round until an answer is receieved
            const result = await this.genSection(prompt, section);
            results[section] = result;
        }

        return{ sections: results, warnings};
    }

    // Single section entrypoint
    /*
    async generate({prompt, section}:{prompt: BuildPromptResult, section:GenerationSectionName}): Promise<LLMGenerationResult>{
        return this.runDebateRoundGC(prompt, section);
    }
    */

    // Debate logic using gemini and claude models
    private async runDebateRoundGC(prompt: BuildPromptResult, section:GenerationSectionName): Promise<LLMGenerationResult>{
        let proposerOutput = ""; 
        let challengerOutput = "";
        let finalOutput = "";

        while(finalOutput == ""){
            for (let round = 1; round <= 3; round++){
                proposerOutput = await this.callGemini(this.geminiKey1,
                    `You are the PROPOSER in a debate system generating content for section "${section}".  
                    Your job is to construct the strongest, clearest, and most well-reasoned answer to the user prompt below.  
                    Focus on accuracy, logical structure, and persuasive argumentation.  
                    Write in a confident, expert tone and avoid unnecessary disclaimers.  

                    PROMPT:
                    ${prompt.prompt}`
                )
                challengerOutput = await this.callGemini(this.geminiKey2,
                    `You are the CHALLENGER in a debate system for section "${section}".

                    Your job is to critically evaluate the PROPOSER’s answer and produce an improved version that:
                    • Strengthens clarity, reasoning, and structure  
                    • Preserves fidelity to the user’s original prompt  
                    • Fixes gaps, weak logic, or missing details  
                    • Removes fluff, repetition, or vague claims  

                    Do not mention that you are the CHALLENGER.  
                    Produce the best possible improved answer.

                    PROPOSER'S ANSWER:
                    ${proposerOutput}

                    PROMPT:
                    ${prompt.prompt}
                    `
                )
            }
            const descision = await this.callClaude(this.claudeKey,
                `You are the JUDGE in a debate-generation system for section "${section}".

                Your task is to evaluate the latest CHALLENGER answer and issue a clear verdict on its quality.
                CHALLENGER’S FINAL ANSWER:
                ${challengerOutput}

                ORIGINAL USER PROMPT:
                ${prompt}

                Judge the answer based on:
                • Clarity and organization  
                • Completeness relative to the original prompt  
                • Logical strength and coherence  
                • Fidelity to the user’s intent  
                • Overall writing quality and tone  

                Your response must follow this exact format (the first characater must be either 1 or 0, 1 for Good, 0 for not good):

                1 or 0
                VERDICT: "Good" or "Not good"

                EXPLANATION:
                A brief explanation (2–4 sentences) describing why you made this judgment and what, if anything, needs improvement.`
            )
            // If the first 
            if (descision[0] == "1"){
                finalOutput = challengerOutput;
            }
            
        }

        return {content: challengerOutput};
    }

    // logic only using open ai models -- NOT Debate logic
    private async genSection(prompt: BuildPromptResult, section: GenerationSectionName):Promise<LLMGenerationResult>{
        let finalOutput = await this.callOpenAI(this.openAIKey, `${prompt.prompt}`);
        let result = {content: finalOutput}
        return result;
    }

    // Helper functions to call gemini, claude, and open ai apis
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

  private async callOpenAI(key: string, text: string): Promise<string> {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
        },
        body: JSON.stringify({
        model: "gpt-4.1-mini", // or gpt-4.1, gpt-4.1-preview, etc.
        messages: [
            {
            role: "user",
            content: text,
            },
        ],
        temperature: 0.7,
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenAI API error: ${err}`);
    }

    const json = await res.json();
    return json.choices?.[0]?.message?.content ?? "";
    }



}





