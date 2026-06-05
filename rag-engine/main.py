import os
import httpx
import tempfile
from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
import uvicorn

# LangChain
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_postgres import PGVector, PGEngine

load_dotenv()

app = FastAPI(title="LangChain RAG Engine")

# import HuggingFace embedding model
print("Loading HuggingFace model...")
embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

# https://docs.langchain.com/oss/python/integrations/vectorstores/pgvectorstore
# connect to LangChain PGVector store -> using asyncpg instead of psycopg
CONNECTION_STRING = os.getenv("DATABASE_URL").replace("postgresql://", "postgresql+psycopg://")

vector_store = PGVector(
    embeddings=embeddings,
    collection_name="discord_documents",
    connection=CONNECTION_STRING,
    use_jsonb=True,
)

"""
Handle Document Ingestion Requests to RAG System
"""

class IngestRequest(BaseModel):
    discord_id: str
    file_url: str
    filename: str

async def process_pdf_langchain(discord_id: str, file_url: str, filename: str):
    print(f"[{discord_id}] Starting LangChain ingestion for {filename}...")
    
    # https://www.python-httpx.org/async/#making-requests
    # download file contents
    async with httpx.AsyncClient() as client:
        response = await client.get(file_url)
        response.raise_for_status()

    # write information from pdf into a temp file
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
        tmp_file.write(response.content)
        tmp_file_path = tmp_file.name

    
    try:
        # use LangChain's PyPDFLoader
        loader = PyPDFLoader(tmp_file_path)
        docs = loader.load()

        # https://docs.langchain.com/langsmith/evaluate-rag-tutorial
        # use RecursiveCharacterTextSplitter to chunk document
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        split_docs = text_splitter.split_documents(docs)

        # inject user's discord id into metadata
        for doc in split_docs:
            doc.metadata["discord_id"] = discord_id
            doc.metadata["filename"] = filename

        # generate embeddings via HuggingFace + insert into PostgreSQL db
        print(f"[{discord_id}] Embedding and storing {len(split_docs)} chunks...")
        vector_store.add_documents(split_docs)
        
        print(f"[{discord_id}] Successfully ingested {filename}!")

    except Exception as e:
        print(f"[{discord_id}] Error processing {filename}: {e}")
         
    finally:
        if os.path.exists(tmp_file_path):
            os.remove(tmp_file_path)

@app.post("/ingest")
async def ingest_document(request: IngestRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(process_pdf_langchain, request.discord_id, request.file_url, request.filename)
    return {"status": "processing", "message": f"Successfully queued {request.filename}."}

"""
Handle Query Requests to RAG System
"""

class QueryRequest(BaseModel):
    discord_id: str
    query: str
    k: int = 4

@app.post("/query")
async def query_documents(request: QueryRequest):
    print(f"[{request.discord_id}] Searching for: '{request.query}'")
    
    try:
        # perform similarity search w/ metadata filter (only use this user's documents)
        # langchain_postgres uses simple dict match or {"field": {"$eq": "value"}}
        # use topk=4 (can change in QueryRequest class definition)
        matched_docs = vector_store.similarity_search(
            query=request.query,
            k=request.k,
            filter={"discord_id": request.discord_id}
        )
        
        # TODO: connect to locally hosted ollama model for generation of text
        # NOTE: this version only retrieves topk closest plaintext and returns that
        
        # format results to send back to the Node.js bot
        results = []
        for doc in matched_docs:
            results.append({
                "content": doc.page_content,
                "metadata": doc.metadata
            })
            
        print(f"[{request.discord_id}] Found {len(results)} matching chunks.")
        return {"status": "success", "results": results}

    except Exception as e:
        print(f"[{request.discord_id}] Error during query execution: {e}")
        raise HTTPException(status_code=500, detail="Internal vector search error.")
    
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=5000)