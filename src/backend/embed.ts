//
// embed.js
//
// Created by Shrish Vishnu Rajesh Kumar on 11/05/2025
//

import 'dotenv/config'
import fetch from 'node-fetch'
import { createClient } from '@supabase/supabase-js'
import { Database } from '../../database.types'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!



if(!SUPABASE_URL || !SUPABASE_SERVICE_KEY){
    throw new Error("Missing Supabase environment variables. Please check your .env file.")
}

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY)


const PYTHON_EMBED_URL = "http://localhost:8000/embed"


interface EmbeddingResponse{
    embedding: number[];
    text: string;
}

// Fetching text to convert
async function fetchText(uploaded_document_id: string): Promise<string>{
    const {data, error} = await supabase
    .from('uploaded_documents')
    .select('extracted_text')
    .eq('id', uploaded_document_id)
    .single()
    if (error){
        console.error("Error fetching text: ", error)
        throw new Error(`Failed to fetch text: ${error.message}`)
    }
    if(!data.extracted_text){
        throw new Error("No extracted text found for the uploaded document")
    }

    return data.extracted_text
}

async function sendToService(extracted_text: string): Promise<EmbeddingResponse>{
    const response = await fetch(PYTHON_EMBED_URL, {
        method: "POST",
        headers: {"Content-Type" : "application/json"},
        body: JSON.stringify({
            content: extracted_text
        })
    })
    return await response.json() as Promise<EmbeddingResponse>
}

async function storeResults(result: EmbeddingResponse | EmbeddingResponse[],
    uploaded_document_id?: string,
    grant_id?: string,
    user_id?: string
): Promise<void>{
    // Handlge both single result and array of results
    const results = Array.isArray(result) ? result: [result]
    for (const embeddingResult of results){
        const {embedding, text} = embeddingResult

        const { error} = await supabase
        .from('document_embeddings')
        .insert({
            content: text,
            embedding: embedding, // passing in number[] directly as pgvector handles the conversion
            uploaded_document_id: uploaded_document_id || null,
            grant_id: grant_id || null,
            user_id: user_id || null,
            created_at: new Date().toISOString()
        })

        if (error){
            console.error('Failed to store embedding: ', error)
            throw new Error('Failed to store embedding: ${error.message')
        }
        console.log(`Embedding stored for text: ${text}`)
    }
}

// To create and put embeddings into supabase

async function createEmbeddings(uploaded_document_id: string,
    grant_id?: string,
    user_id?: string
): Promise<void> {
    try {
    
    const text = await fetchText(uploaded_document_id);

    const result = await sendToService(text);

    await storeResults(result, uploaded_document_id);

    console.log(`Embedding created for document ${uploaded_document_id}`);
  } catch (err) {
    console.error("Failed to create embedding:", err);
  }
}

// For simple queries

export async function embedQuery(query: string) : Promise<number[]>{
    try{
        const result = await sendToService(query);
        if(!result || !Array.isArray(result.embedding)){
            throw new Error("Embedding service did not return a vector");
        }
        console.log("Embedding query completed");
        return result.embedding as number[];
        
    } catch(err){
        console.error("Failed to create embedding for query:", err);
        throw err;
    }
}