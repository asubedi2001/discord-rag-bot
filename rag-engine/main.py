import os
import httpx
import aiofiles.tempfile
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


# NOTE: some advice on model selection taken from
# https://docs.openwebui.com/troubleshooting/rag/

# import HuggingFace embedding model
print("Loading HuggingFace model...")
embeddings = HuggingFaceEmbeddings(model_name="nomic-ai/nomic-embed-text-v1.5")

# https://docs.langchain.com/oss/python/integrations/vectorstores/pgvectorstore
# connect to LangChain PGVector store
CONNECTION_STRING = os.getenv("DATABASE_URL").replace("postgresql://", "postgresql+psycopg://")
OLLAMA_URL = os.getenv("OLLAMA_URL")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL")
MODEL_PROMPT = os.getenv("MODEL_PROMPT")

vector_store = PGVector(
    embeddings=embeddings,
    collection_name="discord_documents",
    connection=CONNECTION_STRING,
    use_jsonb=True,
)
vector_store.create_tables_if_not_exists()

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
    async with aiofiles.tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
        await tmp_file.write(response.content)
        tmp_file_path = tmp_file.name

    try:
        # use LangChain's PyPDFLoader
        loader = PyPDFLoader(tmp_file_path)
        docs = loader.load()

        # https://docs.langchain.com/langsmith/evaluate-rag-tutorial
        # use RecursiveCharacterTextSplitter to chunk document
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
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
    k: int = 5

@app.post("/query", responses={500: {"description": "Internal vector search error."}})
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
        
        # format results to send back to the Node.js bot
        print(f"[{request.discord_id}] Found {len(matched_docs)} matching chunks.")

        context_str = "\n---\n".join([doc.page_content for doc in matched_docs])

        system_prompt = (
            MODEL_PROMPT + "\n\n" +
            f"Context:\n{context_str}"
        )

        print(f"[{request.discord_id}] Sending augmented prompt to Ollama...")

        # default AsyncClient timeout is 5s, give model extra time to generate
        async with httpx.AsyncClient(timeout=30.0) as client:
            ollama_payload = {
                "model": OLLAMA_MODEL,
                "prompt": request.query,
                "system": system_prompt,
                "stream": False
            }
            
            ollama_response = await client.post(OLLAMA_URL, json=ollama_payload)
            ollama_response.raise_for_status()
            
            ollama_data = ollama_response.json()
            response = ollama_data.get("response", "")

        print(f"[{request.discord_id}] Generation complete.")

        return {
            "status": "success", 
            "response": response
        }

    except Exception as e:
        print(f"[{request.discord_id}] Error during query execution: {e}")
        raise HTTPException(status_code=500, detail="Internal vector search error.")
    
"""
Handle Discord OAuth2.0
"""

# https://docs.discord.com/developers/topics/oauth2
class OAuthRequest(BaseModel):
    code: str

@app.post("/auth/discord", responses={400: {"description": "Failed to authenticate with Discord."}})
async def authenticate_discord(request: OAuthRequest):
    """
    Exchanges the temporary Discord code for the user's actual profile data.
    """
    client_id = os.getenv("DISCORD_CLIENT_ID")
    client_secret = os.getenv("DISCORD_CLIENT_SECRET")
    redirect_uri = os.getenv("DISCORD_REDIRECT_URI", "http://localhost:5173/") # port 5173 for React Vite

    token_data = {
        "client_id": client_id,
        "client_secret": client_secret,
        "grant_type": "authorization_code",
        "code": request.code,
        "redirect_uri": redirect_uri
    }

    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://discord.com/api/oauth2/token", 
            data=token_data
        )

        if token_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to authenticate with Discord.")
        
        access_token = token_response.json()["access_token"]

        user_response = await client.get(
            "https://discord.com/api/users/@me",
            headers={"Authorization": f"Bearer {access_token}"}
        )

        if user_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to fetch discord user data.")
        
        user_data = user_response.json()

        # TODO: Implement generation/handling of JWT Tokens

        return {
            "status": "success",
            "user": {
                "discord_id": str(user_data["id"]),
                "username": user_data["username"],
                "avatar": f"https://cdn.discordapp.com/avatars/{user_data['id']}/{user_data['avatar']}.png" if user_data.get('avatar') else None
            }
        }

if __name__ == "__main__":
    uvicorn.run(app, host=os.getenv("HOST"), port=5000)