from fastapi import FastAPI
from pydantic import BaseModel
from huggingface_hub import InferenceClient
import os

# ---- Model configuration ----
MODEL_ID = "google/embeddinggemma-300m"
HF_TOKEN = os.getenv("HUGGINGFACE_TOKEN")

client = InferenceClient(model=MODEL_ID, token=HF_TOKEN)

# ---- Request schema ----
class EmbeddingRequest(BaseModel):
    content: str

# ---- App setup ----
app = FastAPI(title="Embedding API", version="1.1")

@app.post("/embed")
def generate_embeddings(request: EmbeddingRequest):
    """
    Generate embeddings for a given text using google/embedding-gemma-300m.
    """
    try:
        embedding = client.feature_extraction(request.content)

        if not isinstance(embedding, list):
            embedding = embedding.tolist()
        
        if isinstance(embedding[0], list):
            dim = len(embedding[0])
        else:
            dim = len(embedding)

        return {"embedding": embedding, "dimension": dim}
    except Exception as e:
        return {"error": str(e)}
