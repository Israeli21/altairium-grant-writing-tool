from fastapi import FastAPI
from pydantic import BaseModel
import requests
from huggingface_hub import InferenceClient
import os



# Model information
model_id = "sentence-transformers/all-MiniLM-L6-v2"
hf_token = os.getenv("HUGGINGFACE_TOKEN")

# Testing the model
client = InferenceClient(model="sentence-transformers/all-MiniLM-L6-v2", token=hf_token)

# Pydantic object
class EmbeddingRequest(BaseModel):
    content: str

app = FastAPI()

@app.post("/embed")
def generate_embeddings(request: EmbeddingRequest):
    return client.feature_extraction(request.content)
