from fastapi import FastAPI
from pydantic import BaseModel
import requests
from huggingface_hub import InferenceClient
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Model information
model_id = "google/embeddinggemma-300m"
hf_token = os.getenv("HUGGINGFACE_TOKEN")
print(f"Using HuggingFace token: {hf_token[:10]}..." if hf_token else "No token found!")

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
    print(f"Received embedding request for text: {request.content[:100]}...")
    try:
        print("Calling HuggingFace API...")
        embedding = client.feature_extraction(request.content)
        print(f"Got response, type: {type(embedding)}")

        if not isinstance(embedding, list):
            embedding = embedding.tolist()
        
        print(f"Returning embedding with {len(embedding)} dimensions")
        return {"embedding": embedding, "text" : request.content}
    except Exception as e:
        print(f"ERROR generating embedding: {str(e)}")
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    print("Starting embedding service on port 8001...")
    uvicorn.run(app, host="0.0.0.0", port=8001)
