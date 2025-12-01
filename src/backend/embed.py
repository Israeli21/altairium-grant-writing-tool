from fastapi import FastAPI
from pydantic import BaseModel
import requests
from huggingface_hub import InferenceClient
import os
from dotenv import load_dotenv
from pathlib import Path

# Load .env file from project root
load_dotenv(dotenv_path='../../.env')

# Model information
model_id = "google/embeddinggemma-300m"
hf_token = os.getenv("HUGGINGFACE_TOKEN") or os.getenv("HF_TOKEN")

if hf_token:
    # Show first and last 4 chars for verification
    token_preview = f"{hf_token[:4]}...{hf_token[-4:]}" if len(hf_token) > 8 else "***"
    print(f"HuggingFace Token: Found ({token_preview})")
else:
    print("HuggingFace Token: Missing!")
    print("   Please set HUGGINGFACE_TOKEN in your .env file or environment variables")
    print("   Get your token from: https://huggingface.co/settings/tokens")

# Testing the model
if not hf_token:
    raise ValueError("HUGGINGFACE_TOKEN is required. Please set it in your .env file or environment variables.")

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
        error_msg = str(e)
        # Provide helpful error messages
        if "401" in error_msg or "Unauthorized" in error_msg or "Invalid username or password" in error_msg:
            return {
                "error": f"Authentication failed with Hugging Face. Please check your HUGGINGFACE_TOKEN.\n"
                         f"Current token: {'Set' if hf_token else 'Not set'}\n"
                         f"Get a new token from: https://huggingface.co/settings/tokens\n"
                         f"Original error: {error_msg}"
            }
        return {"error": error_msg}

if __name__ == "__main__":
    import uvicorn
    print("Starting embedding service on port 8001...")
    uvicorn.run(app, host="0.0.0.0", port=8001)
