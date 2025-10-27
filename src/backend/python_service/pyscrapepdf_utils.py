"""
pyscrapepdf_utils.py
Lightweight FastAPI service for scraping and cleaning text from PDFs
"""

from fastapi import FastAPI
from pydantic import BaseModel
import requests
import fitz

app = FastAPI()

class PDFRequest(BaseModel):
    url: str

# Endpoint to scrape text
@app.post("/scrape")
def scrape_pdf(request: PDFRequest):

    print(f"Scraping {request.url}")
    
    # Getting pdf
    response = requests.get(request.url)
    pdf_bytes = response.content
    
    # Need to explore what irs forms look like to properly scrape them
    
    # Cleaning text
