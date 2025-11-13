//
// embed.js
//
// Created by Shrish Vishnu Rajesh Kumar on 11/05/2025
//

import 'dotenv/config'
import fetch from 'node-fetch'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

const PYTHON_EMBED_URL = "http://localhost:8000/embed"

// Fetching text to convert
async function fetchText(){
    const {data, error} = await supabase
    .from('uploaded_documents')
    .select('extracted_text')
    .eq('id', uploaded_document_id)
    .single()
    if (error) error
    if (error){
        console.error("Error fetching text: ", error)
        throw error;
    }

    return data.extracted_text
}

async function sendToService(extracted_text){
    const response = await fetch(PYTHON_EMBED_URL, {
        method: "POST",
        headers: {"Content-Type" : "application/json"},
        body: JSON.stringify({
            content: extracted_text
        })
    })
    return await response.json
}

async function storeResults(results){
    for (const result in results){
        const {embedding, text} = result
        const {error} = await supabase
        .from('document_embeddings')
        .update({
            content: text,
            embedding: embedding,
            created_at: new Date()
        })

        if (error) console.error('Failed to update ${url}:', error)
    }
}

// Main orchestration

async function createEmbeddings(uploaded_document_id) {
    try {
    
    const text = await fetchText(uploaded_document_id);

    const result = await sendToService(text);

    await storeResults(result, uploaded_document_id);

    console.log(`Embedding created for document ${uploaded_document_id}`);
  } catch (err) {
    console.error("Failed to create embedding:", err);
  }
}