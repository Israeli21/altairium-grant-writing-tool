"""
pyscrapepdf_utils.py
Lightweight FastAPI service for scraping and cleaning text from PDFs

Created by Shrish Vishnu Rajesh Kumar on 11/5/2025
"""

from fastapi import FastAPI
from pydantic import BaseModel
import requests
import fitz
import re
from typing import List

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
    return results




# Helper functions to identify/parse forms
def identifyFormType(pdfBytes: bytes) -> str:
    document = fitz.open(stream=pdfBytes, filetype="pdf")
    firstPageText = document[0].get_text()
    if "Form 990" in firstPageText:
        return "990"
    elif "Form 1023" in firstPageText:
        return "1023"
    
    return "generic"

# Parsing IRS Form 990
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

'''
Parsing 1023 Form
This extracts both the raw text and summary versions - which is the ideal format for
creating embeddings. Form 1023 goes into more depth about the nonprofit's mission than 990,
so drawing this distinction between the two parsing funcs is important.
'''
def parse1023(pdfBytes: bytes):
    document = fitz.open(stream=pdfBytes, filetype="pdf")
    text = "\n".join(p.get_text("text") for p in document)
    clean = re.sub(r"\s+", " ", text).strip()

    data = {
        "mission_narrative_raw": extract_mission(clean),
        "mission_narrative_summary": summarize_section(extract_mission(clean)),
        "program_allocation_raw": extract_program_allocation(clean),
        "program_allocation_summary": summarize_allocation(clean),
        "membership_model_raw": extract_membership_model(clean),
        "membership_model_summary": summarize_section(extract_membership_model(clean)),
        "fiscal_sponsorship_raw": extract_fiscal_sponsorship(clean),
        "fiscal_sponsorship_summary": summarize_section(extract_fiscal_sponsorship(clean)),
        "conflict_policy_raw": extract_conflict_policy(clean),
        "conflict_policy_summary": summarize_section(extract_conflict_policy(clean)),
        "compensation_policy_raw": extract_compensation_policy(clean),
        "compensation_policy_summary": summarize_section(extract_compensation_policy(clean)),
        "governance_framework_raw": extract_governance_framework(clean),
        "governance_framework_summary": summarize_section(extract_governance_framework(clean)),
        "fiscal_controls_raw": extract_fiscal_controls(clean),
        "fiscal_controls_summary": summarize_section(extract_fiscal_controls(clean)),
        "irs_compliance_raw": extract_irs_compliance(clean),
        "irs_compliance_summary": summarize_section(extract_irs_compliance(clean)),
    }
    return data

# Parsing other form
def parseGeneric(pdfBytes: bytes):
    raise ValueError("needs to be completed")



'''
 Helper functions for parsing form 990
'''
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


'''
 Helper functions for parsing form 1023
'''
def extract_mission(text: str) -> str:
    m = re.search(r"(NARRATIVE DESCRIPTION OF ACTIVITIES|PART VI).*?(?=PART V|FISCAL SPONSORSHIP|CONFLICT)", text)
    return m.group(0).strip() if m else ""

def extract_program_allocation(text: str) -> str:
    m = re.search(r"(60 ?%|25 ?%|15 ?%).*?(?=FISCAL SPONSORSHIP|CONFLICT)", text)
    return m.group(0).strip() if m else ""

def extract_membership_model(text: str) -> str:
    m = re.search(r"SUPPORTER.*?\$?500\+", text)
    return m.group(0).strip() if m else ""

def extract_fiscal_sponsorship(text: str) -> str:
    m = re.search(r"FISCAL SPONSORSHIP AGREEMENT.*?(?=CONFLICT|BYLAWS|ARTICLE)", text)
    return m.group(0).strip() if m else ""

def extract_conflict_policy(text: str) -> str:
    m = re.search(r"CONFLICT[S]? OF INTEREST POLICY.*?(?=BYLAWS|FISCAL SPONSORSHIP|ARTICLE)", text)
    return m.group(0).strip() if m else ""

def extract_compensation_policy(text: str) -> str:
    m = re.search(r"COMPENSATION|SECTION 4\.12.*?SECTION 6\.14.*?(?=ARTICLE|FISCAL)", text)
    return m.group(0).strip() if m else ""

def extract_governance_framework(text: str) -> str:
    m = re.search(r"BYLAWS.*?(ARTICLE VIII|FISCAL YEAR)", text)
    return m.group(0).strip() if m else ""

def extract_fiscal_controls(text: str) -> str:
    m = re.search(r"(FINANCIAL PROCEDURES|REPORTING).*?(?=ARTICLE|FISCAL YEAR|COMPLIANCE)", text)
    return m.group(0).strip() if m else ""

def extract_irs_compliance(text: str) -> str:
    m = re.search(r"501\(C\)\(3\)|NO POLITICAL ACTIVITY.*?(?=END|$)", text)
    return m.group(0).strip() if m else ""

def summarize_section(raw: str) -> str:
    if not raw:
        return ""
    clean = re.sub(r"\s+", " ", raw)
    return " ".join(clean.split()[:60]) + "..." if len(clean.split()) > 60 else clean

def summarize_allocation(text: str):
    alloc = {}
    for program, pct in re.findall(r"(NEWSROOM|WRITING SEMINARS|PUBLIC FORUMS).*?(\d{1,2} ?%)", text.upper()):
        alloc[program.title()] = pct
    return alloc