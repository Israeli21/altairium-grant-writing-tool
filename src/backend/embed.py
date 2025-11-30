from fastapi import FastAPI
from pydantic import BaseModel
import requests
from huggingface_hub import InferenceClient
import os
from dotenv import load_dotenv

# Load .env file from project root
load_dotenv(dotenv_path='../../.env')

# Model information
model_id = "google/embeddinggemma-300m"
hf_token = os.getenv("HUGGINGFACE_TOKEN")

print(f"🔑 HuggingFace Token: {'✅ Found' if hf_token else '❌ Missing'}")

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

        return {"embedding": embedding, "text" : request.content}
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    print("Starting embedding service on port 8001...")
    uvicorn.run(app, host="0.0.0.0", port=8001)
