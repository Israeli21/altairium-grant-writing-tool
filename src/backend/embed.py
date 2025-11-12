from fastapi import FastAPI
from pydantic import BaseModel
import requests
from huggingface_hub import InferenceClient
import os



# Model information
model_id = "google/embeddinggemma-300m"
hf_token = os.getenv("HUGGINGFACE_TOKEN")

# Testing the model
client = InferenceClient(model=model_id, token=hf_token)

# Pydantic object
class EmbeddingRequest(BaseModel):
    content: str

app = FastAPI()


@app.post("/embed")
def generate_embeddings(request: EmbeddingRequest):
    """
    Generate embeddings for a given text using google/embedding-gemma-300m.
    """
    try:
        embedding = client.feature_extraction(request.content)

        if not isinstance(embedding, list):
            embedding = embedding.tolist()

        return {"embedding": embedding}
    except Exception as e:
        return {"error": str(e)}
