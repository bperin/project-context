#!/usr/bin/env python3
"""
GraphRAG Qdrant Initializer & Client
Connects to a local Qdrant instance, creates structured collections for
GraphRAG entities and relationships, and provides query/ingestion helpers.
"""

import os
from qdrant_client import QdrantClient
from qdrant_client.http import models

QDRANT_HOST = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", 6333))
COLLECTION_NAME = "project_graphrag_entities"

def get_client():
    return QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)

def init_collection():
    client = get_client()
    collections = client.get_collections().collections
    exists = any(c.name == COLLECTION_NAME for c in collections)
    
    if not exists:
        print(f"Creating Qdrant collection: {COLLECTION_NAME}")
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=models.VectorParams(
                size=1536,  # standard embedding size (e.g., OpenAI text-embedding-3-small)
                distance=models.Distance.COSINE
            )
        )
        print("Collection created successfully.")
    else:
        print(f"Collection {COLLECTION_NAME} already exists.")

if __name__ == "__main__":
    print(f"Connecting to Qdrant at {QDRANT_HOST}:{QDRANT_PORT}...")
    try:
        init_collection()
    except Exception as e:
        print(f"Failed to connect or initialize Qdrant: {e}")
        print("Make sure Qdrant is running: docker compose up -d")
        exit(1)
