//
// embed.js
//
// Created by Shrish Vishnu Rajesh Kumar on 11/05/2025
//

import 'dotenv/config'
import fetch from 'node-fetch'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

const PYTHON_EMBED_URL = "http://localhost:8000"

// Fetching text to convert
/* working on this
async function fetchText(){
    const {data, error} = await supabase
    .from('uploaded_documents')
}
*/