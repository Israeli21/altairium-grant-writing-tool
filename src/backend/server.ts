// backend/server.ts - Express server for grant generation

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

import { generateGrant, GenerateGrantInput } from './generateGrant';
import { processDocumentsByIds } from './createEmbeddings';

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'grant-generation' });
});

// Process documents endpoint - scrape PDFs and create embeddings
app.post('/process-documents', async (req, res) => {
  try {
    const { documentIds } = req.body;
    
    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return res.status(400).json({ error: 'documentIds array is required' });
    }

    console.log(`\n📄 Processing ${documentIds.length} documents...`);
    const results = await processDocumentsByIds(documentIds);

    const successCount = results.filter(r => r.status === 'success').length;
    res.json({ 
      success: true, 
      processed: successCount,
      total: documentIds.length,
      results 
    });
  } catch (error: any) {
    console.error('Process documents error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Grant generation endpoint
app.post('/generate-grant', async (req, res) => {
  try {
    console.log('Received grant generation request:', req.body);
    
    const input: GenerateGrantInput = {
      userRequest: req.body.userRequest || req.body.description || '',
      grantId: req.body.grantId,
      nonprofitId: req.body.nonprofitId,
      matchCount: req.body.matchCount || 10,
      sections: req.body.sections, // Optional: specific sections to generate
    };

    if (!input.userRequest) {
      return res.status(400).json({ 
        error: 'Missing required field: userRequest or description' 
      });
    }

    const result = await generateGrant(input);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    console.error('Grant generation error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to generate grant',
      details: error.toString()
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Grant generation server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Process docs: POST http://localhost:${PORT}/process-documents`);
  console.log(`Generate grant: POST http://localhost:${PORT}/generate-grant`);
});
