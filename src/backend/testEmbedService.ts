/**
 * testEmbedService.ts - Debug embedding service
 */

import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

import fetch from 'node-fetch';

const PYTHON_EMBED_URL = process.env.PYTHON_EMBED_URL || 'http://localhost:8001/embed';

async function testEmbedding() {
  console.log('🔍 Testing embedding service...\n');
  console.log(`URL: ${PYTHON_EMBED_URL}\n`);

  const testText = "This is a test document about robotics education.";

  try {
    const response = await fetch(PYTHON_EMBED_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: testText })
    });

    console.log(`Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error:', errorText);
      return;
    }

    const result = await response.json() as any;
    
    console.log('\n📊 Response structure:');
    console.log('Keys:', Object.keys(result));
    
    if (result.embedding) {
      console.log(`\n✅ Embedding found!`);
      console.log(`Type: ${typeof result.embedding}`);
      console.log(`Is Array: ${Array.isArray(result.embedding)}`);
      console.log(`Length: ${result.embedding.length}`);
      console.log(`First 5 values: [${result.embedding.slice(0, 5).join(', ')}...]`);
      console.log(`Sample value type: ${typeof result.embedding[0]}`);
    } else {
      console.log('\n❌ No embedding in response!');
      console.log('Full response:', JSON.stringify(result, null, 2));
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

testEmbedding();

