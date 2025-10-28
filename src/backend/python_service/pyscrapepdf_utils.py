"""
pyscrapepdf_utils.py
Lightweight FastAPI service for scraping and cleaning text from PDFs
"""

from fastapi import FastAPI
from pydantic import BaseModel
import requests
import fitz
import re

app = FastAPI()
class PDFRequest(BaseModel):
    urls: List[str]


@app.post("/scrape")
def scrape_pdf(request: PDFRequest):
    results = []
    
    for url in request.urls:
    
        # Getting pdf from database
        response = requests.get(request.url)
        pdfBytes = response.content
        
        formType = identifyFormType(pdfBytes)

        if(formType == "990"):
            data = parse990(pdfBytes)
        elif(formType == "1023"):
            data = parse1023(pdfBytes)
        else:
            data = parseGeneric(pdfBytes)
        
        results.append({"url": url, "form_type": formType, "data": data})

    

    # Need to explore what irs forms look like to properly scrape them
    
    
    # Clearning text (making embeddings less computationally heavy)



# Helper functions to identify/parse forms
def identifyFormType(pdfBytes: bytes) -> str:
    document = fitz.open(stream=pdfBytes, filetype="pdf")
    firstPageText = document[0].get_text()
    if "Form 990" in firstPageText:
        return "990"
    elif "Form 1023" in firstPageText:
        return "1023"
    
    return "generic"

def parse990(pdfBytes: bytes):
    document = fitz.open(stream=pdfBytes, filetype="pdf")

    fullText = "\n".join(page.get_text("text") for page in document)
    fullText = re.sub(r'\s+', ' ', fullText).strip().upper()

    data = {
        "organization_info": extractOrgInfo(fullText),
        "mission": extractMission(fullText),
        "programs": extractPrograms(fullText),
        "financials": extractFinancials(fullText),
        "governance": extractGovernance(fullText),
        "schedule_o": extractSchedule(fullText),
    }
    return data

def parse1023(pdfBytes: bytes):
    raise ValueError("needs to be completed")

def parseGeneric(pdfBytes: bytes):
    raise ValueError("needs to be completed")

# Helper functions for parsing form 990
def extractOrgInfo(text: str):
    info = {}
    nameMatch = re.search(r"NAME OF ORGANIZATION\s+([A-Z0-9 ,.&'-]+)", text)
    einMatch = re.search(r"EMPLOYER IDENTIFICATION NUMBER\s+(\d{2}-\d{7})", text)
    websiteMatch = re.search(r"WWW\.[A-Z0-9.-]+", text)

    if nameMatch: info["name"] = nameMatch.group(1).title()
    if einMatch: info["name"] = einMatch.group(1)
    if websiteMatch: info["website"] = websiteMatch.group(0).lower()
    return info

def extractMission(text: str) -> str:
    m = re.search(r"MISSION:? ?([A-Z ,.'-]+?)(PROGRAM SERVICE|PART III|CHECKLIST)", text)
    return m.group(1).title().strip() if m else ""

def extractPrograms(text: str):
    programs = re.findall(r"PROGRAM\s+\d+\s*[-:]\s*([A-Z0-9 ,.'-]+?)\s+\(?EXPENSES", text)
    expenses = re.findall(r"EXPENSES\s*\$?\s*([\d,]+)", text)
    return [{"program": p.title(), "expenses": e} for p, e in zip(programs, expenses)]

def extractFinancials(text: str):
    revMatch = re.search(r"TOTAL REVENUE.*?([\d,]+)\.", text)
    expMatch = re.search(r"TOTAL EXPENSES.*?([\d,]+)\.", text)
    netAssetsMatch = re.search(r"NET ASSETS.*?([\d,]+)\.", text)
    return {
        "total_revenue": revMatch.group(1) if revMatch else "",
        "total_expenses": expMatch.group(1) if expMatch else "",
        "net_assets": netAssetsMatch.group(1) if netAssetsMatch else ""
    }

def extractGovernance(text: str):
    officers = re.findall(r"(TRUSTEE|EMPLOYEE|DIRECTOR|CHAIRMAN|CEO|CFO)[A-Z ,.'-]+?\s+(\d{1,3},?\d{0,3})?\s*0?\s*\d{0,3}", text)
    return [o[0].title() for o in officers]

def extractSchedule(text: str):
    m = re.search(r"SCHEDULE O(.*?)SCHEDULE [A-Z]", text)
    return m.group(1).strip() if m else ""







