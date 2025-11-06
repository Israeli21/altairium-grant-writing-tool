//
//  scrape.js
//  
//
//  Created by Shrish Vishnu Rajesh Kumar on 10/27/25.
//

import 'dotenv/config'
import fetch from 'node-fetch'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
 
const PYTHON_SCRAPER_URL = "http://localhost:8000/scrape"

// Step 1: Fetch PDFs to process
async function fetchDocuments(limit = 5){
    const {data, error} = await supabase
    .from('uploaded_documents')
    .select('id, file_name, file_url, file_type, extracted_text')
    .is('extracted_text', null)

    if(error) error
    return data
}
// Step 2: Send PDFs to python microservice
async function sendToService(urls){
    const response = await fetch(PYTHON_SCRAPER_URL, {
        method: "POST",
        headers: {"Content-Type": "application/json" },
        body: JSON.stringify({urls})
    })

    if (!response.ok) throw new Error("Scraper error: ${response.statusText}");
    return await response.json();    
}

// Step 3: Insert results back into supabase
async function storeResults(results){
    for (const result of results){
        const {url, data, form_type} = result
        const { error } = await supabase
        .from('uploaded_documents')
        .update({
            extracted_text: JSON.stringify(data),
            form_type,
            processed_at: new Date()
        })
        .eq('file_url', url)

        if (error) console.error('Failed to update ${url}:', error)
    }
}


// Main orchestration

async function processBatch() {
    const documents = await fetchDocuments(5)
    if(!documents.length){
        console.log("No unprocessed documents found")
        return
    }

    const urls = documents.map(d => d.file_url)
    console.log("Sending to scraper:", urls)

    const results = await sendToScraper(urls)
    console.log("Scraper results:", results)

    await storeResults(results)
    console.log("All documents processed and stored.")
}

processBatch().catch(console.error)

