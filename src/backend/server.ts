// backend/server.ts - Express server for grant generation

import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { generateGrant, GenerateGrantInput } from './generateGrant';

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'grant-generation' });
});

// Grant generation endpoint
app.post('/generate-grant', async (req, res) => {
  try {
    console.log('Received grant generation request:', req.body);
    
    const input: GenerateGrantInput = {
      userRequest: req.body.userRequest || req.body.description || '',
      nonprofitId: req.body.nonprofitId,
      matchCount: req.body.matchCount || 5
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
  console.log(`🚀 Grant generation server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Generate endpoint: POST http://localhost:${PORT}/generate-grant`);
});
