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

FASTAPILINK = "http://localhost:8000/scrape"
const PYTHON_SCRAPER_URL = FASTAPILINK

// Step 1: Fetch PDFs to process


// Step 2: Send PDFs to python microservice


// Step 3: Insert results back into supabase

// Main orchestration
