/**
 * testOpenAI.ts
 * Simple test to verify OpenAI API key is working
 * 
 * Run: npx tsx testOpenAI.ts
 */

import 'dotenv/config';
import dotenv from 'dotenv'
dotenv.config({ path: '../../.env' })

const OPENAI_KEY = process.env.OPENAI_KEY;

async function testOpenAI() {
  console.log('🔑 Testing OpenAI API Key...\n');

  if (!OPENAI_KEY) {
    console.error('❌ OPENAI_KEY not found in environment variables!');
    console.log('   Make sure your .env file has: OPENAI_KEY=sk-...');
    process.exit(1);
  }

  console.log(`   Key found: ${OPENAI_KEY.substring(0, 10)}...${OPENAI_KEY.substring(OPENAI_KEY.length - 4)}`);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1',
        messages: [
          { role: 'user', content: 'What color is an apple? Reply in one word.' }
        ],
        max_completion_tokens: 10,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('\n❌ OpenAI API Error:');
      console.error(JSON.stringify(error, null, 2));
      process.exit(1);
    }

    const data = await response.json() as any;
    const answer = data.choices?.[0]?.message?.content;

    console.log('\n✅ OpenAI API is working!');
    console.log(`   Question: "What color is an apple?"`);
    console.log(`   Answer: "${answer}"`);
    console.log(`   Model: ${data.model}`);
    console.log(`   Tokens used: ${data.usage?.total_tokens}`);

  } catch (error: any) {
    console.error('\n❌ Failed to connect to OpenAI:');
    console.error(`   ${error.message}`);
    process.exit(1);
  }
}

testOpenAI();

