import os
import json
import uuid
import httpx
import asyncio
import aiofiles
import aiofiles.tempfile
import jwt
from datetime import datetime, timezone, timedelta
from fastapi import FastAPI, BackgroundTasks, HTTPException, Request, Header, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Annotated, Optional
from dotenv import load_dotenv
import uvicorn
from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import create_async_engine
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_postgres import PGVector

load_dotenv()

# Load .env variables
JWT_SECRET         = os.getenv("JWT_SECRET")
INTERNAL_API_KEY   = os.getenv("INTERNAL_API_KEY")
DATABASE_URL       = os.getenv("DATABASE_URL")
OLLAMA_URL         = os.getenv("OLLAMA_URL")
OLLAMA_MODEL       = os.getenv("OLLAMA_MODEL")
MODEL_PROMPT       = os.getenv("MODEL_PROMPT")
FRONTEND_URL       = os.getenv("FRONTEND_URL")
HF_EMBED_MODEL     = os.getenv("HF_EMBED_MODEL")

# 20 MB upload cap
MAX_UPLOAD_BYTES = 20 * 1024 * 1024
JWT_TTL_HOURS    = 1

app = FastAPI(title="LangChain RAG Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

embeddings = HuggingFaceEmbeddings(model_name=HF_EMBED_MODEL)

# https://docs.langchain.com/oss/python/integrations/vectorstores/pgvectorstore
# Connect to LangChain PGVector store

# synchronous db engine -> only used once at startup to safely create tables, then disposed.
SYNC_DB_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://")
sync_engine = create_engine(SYNC_DB_URL)
sync_vector_store = PGVector(
    embeddings=embeddings,
    collection_name="discord_documents",
    connection=sync_engine,
    use_jsonb=True,
)
sync_vector_store.create_tables_if_not_exists()
sync_engine.dispose()

# asynchronous db engine -> used for all db operations
ASYNC_DB_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")
engine = create_async_engine(ASYNC_DB_URL, pool_size=5, max_overflow=10)
vector_store = PGVector(
    embeddings=embeddings,
    collection_name="discord_documents",
    connection=engine,
    use_jsonb=True,
)

# authentication dependency
async def get_caller_identity(
    request: Request,
    x_internal_key: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
) -> str:
    """
    Dual-caller auth dependency. Returns the verified discord_id string.
    Will either come from discord bot or web app.

    Bot path:   X-Internal-Key header -> verify key -> read discord_id from body
    Web path:   Authorization: JWT Bearer -> decode -> extract discord_id

    Raises HTTP 401 on any failure.
    """

    # call from bot
    if x_internal_key is not None:
        if not INTERNAL_API_KEY or x_internal_key != INTERNAL_API_KEY:
            raise HTTPException(status_code=401, detail="Invalid internal API key.")

        # Read + cache the body so the endpoint Pydantic model can still parse it.
        # FastAPI normally prohibits reading the body twice; caching on request.state
        # lets the endpoint's Pydantic model re-parse without a second network read.
        if not hasattr(request.state, "_body"):
            request.state._body = await request.body()

        try:
            body = json.loads(request.state._body)
            discord_id = body.get("discord_id")
        except (json.JSONDecodeError, AttributeError):
            discord_id = None

        if not discord_id:
            raise HTTPException(status_code=401, detail="discord_id required in body for internal key auth.")

        return str(discord_id)

    # call from web app
    elif authorization and authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ").strip()
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            discord_id = payload.get("discord_id")
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="JWT expired.")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Invalid JWT.")

        if not discord_id:
            raise HTTPException(status_code=401, detail="JWT missing discord_id.")

        return str(discord_id)

    else:
        raise HTTPException(status_code=401, detail="Missing authentication credentials.")


### Document Ingestion ###

class IngestRequest(BaseModel):
    file_url: str
    filename: str
    # discord_id is optional, bot sends explicitly, frontend does not.
    discord_id: Optional[str] = None

async def process_pdf_langchain(
    discord_id: str,
    file_url: str,
    filename: str,
    local_file: bool = False,
):
    """
    Core ingestion worker. Supports two modes:
      local_file=True  — file_url is an absolute path on disk (written by /upload).
      local_file=False — file_url is an HTTP/HTTPS URL fetched by the bot path.
    """
    print(f"[{discord_id}] Starting LangChain ingestion for {filename}...")

    if local_file:
        # File was already written to disk by /upload; use it directly.
        tmp_file_path = file_url
    else:
        # Bot path: download from the supplied URL.
        async with httpx.AsyncClient() as client:
            response = await client.get(file_url)
            response.raise_for_status()

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
            doc.metadata["filename"] = os.path.basename(filename)  # extra safety

        # generate embeddings via HuggingFace + insert into PostgreSQL db
        print(f"[{discord_id}] Embedding and storing {len(split_docs)} chunks...")
        await vector_store.aadd_documents(split_docs)

        print(f"[{discord_id}] Successfully ingested {filename}!")

    except Exception as e:
        print(f"[{discord_id}] Error processing {filename}: {e}")

    finally:
        if os.path.exists(tmp_file_path):
            os.remove(tmp_file_path)

@app.post("/ingest")
async def ingest_document(
    request: Request,
    background_tasks: BackgroundTasks,
    discord_id: Annotated[str, Depends(get_caller_identity)],
):
    """
    Internal-key path only (Discord bot). The web frontend uses /upload instead.
    The file_url must point to a trusted internal or Discord CDN location;
    the bot is responsible for supplying a valid URL.
    """
    # Re-parse body using the cached bytes set by get_caller_identity (bot path)
    # or a fresh parse (web path, body not yet consumed).
    body_bytes = getattr(request.state, "_body", None) or await request.body()
    body = IngestRequest.model_validate_json(body_bytes)

    background_tasks.add_task(
        process_pdf_langchain, discord_id, body.file_url, body.filename
    )
    return {"status": "processing", "message": f"Successfully queued {body.filename}"}


@app.post("/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    discord_id: Annotated[str, Depends(get_caller_identity)],
    file: UploadFile = File(...),
):
    """
    Web-frontend upload path. Accepts the raw PDF bytes via multipart/form-data,
    so the client never supplies a URL (eliminates SSRF).

    Security checks performed here:
      - MIME type must be application/pdf
      - First 4 bytes must match the PDF magic number (%PDF)
      - File size must not exceed MAX_UPLOAD_BYTES (20 MB)
      - Filename is sanitised with os.path.basename to block path traversal
    """
    # --- Filename sanitisation (block path traversal) ---
    safe_filename = os.path.basename(file.filename or "upload.pdf")
    if not safe_filename:
        raise HTTPException(status_code=400, detail="Invalid filename.")

    # --- MIME type check ---
    if file.content_type not in ("application/pdf", "application/octet-stream"):
        raise HTTPException(status_code=415, detail="Only PDF files are accepted.")

    # --- Read bytes (enforce size cap) ---
    contents = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit.",
        )

    # --- Magic-byte validation (%PDF) ---
    if not contents.startswith(b"%PDF"):
        raise HTTPException(status_code=415, detail="File does not appear to be a valid PDF.")

    # --- Write to a temp file and queue ingestion ---
    tmp_path = os.path.join(
        os.getenv("TMPDIR", "/tmp"),
        f"{discord_id}_{uuid.uuid4()}_{safe_filename}"
    )
    async with aiofiles.open(tmp_path, "wb") as f:
        await f.write(contents)

    # Use a file:// URI so process_pdf_langchain can load it directly.
    # The temp file is deleted inside process_pdf_langchain's finally block.
    background_tasks.add_task(
        process_pdf_langchain, discord_id, tmp_path, safe_filename, local_file=True
    )
    return {"status": "processing", "message": f"Successfully queued {safe_filename}"}


### Querying ###

class QueryRequest(BaseModel):
    query: str
    k: int = 5
    # discord_id optionally accepted (sent by bot)
    discord_id: Optional[str] = None

@app.post("/query", responses={500: {"description": "Internal vector search error."}})
async def query_documents(
    request: Request,
    discord_id: Annotated[str, Depends(get_caller_identity)],
):
    body_bytes = getattr(request.state, "_body", None) or await request.body()
    body = QueryRequest.model_validate_json(body_bytes)

    print(f"[{discord_id}] Searching for: '{body.query}'")
    
    try:
        # perform similarity search w/ metadata filter (only use this user's documents)
        # langchain_postgres uses simple dict match or {"field": {"$eq": "value"}}
        # use topk=4 (can change in QueryRequest class definition)
        matched_docs = await vector_store.asimilarity_search(
            query=body.query,
            k=body.k,
            filter={"discord_id": discord_id}
        )
        
        # format results to send back
        print(f"[{discord_id}] Found {len(matched_docs)} matching chunks.")

        context_str = "\n---\n".join([doc.page_content for doc in matched_docs])

        system_prompt = (
            MODEL_PROMPT + "\n\n" +
            f"Context:\n{context_str}"
        )

        print(f"[{discord_id}] Sending augmented prompt to Ollama...")

        # default AsyncClient timeout is 5s, give model extra time to generate
        async with httpx.AsyncClient(timeout=30.0) as client:
            ollama_payload = {
                "model": OLLAMA_MODEL,
                "prompt": body.query,
                "system": system_prompt,
                "stream": False
            }
            
            ollama_response = await client.post(OLLAMA_URL, json=ollama_payload)
            ollama_response.raise_for_status()
            
            ollama_data = ollama_response.json()
            response = ollama_data.get("response", "")

        print(f"[{discord_id}] Generation complete.")

        return {
            "status": "success", 
            "response": response
        }

    except Exception as e:
        print(f"[{discord_id}] Error during query execution: {e}")
        raise HTTPException(status_code=500, detail="Internal vector search error.")


# list and delete documents
@app.get("/documents")
async def get_documents(
    request: Request,
    discord_id: Annotated[str, Depends(get_caller_identity)],
):
    """
    Returns the distinct filenames ingested by this user.
    """
    async with engine.begin() as conn:
        result = await conn.execute(
            text(
                """
                SELECT DISTINCT cmetadata->>'filename' AS filename
                FROM langchain_pg_embedding
                WHERE cmetadata->>'discord_id' = :discord_id
                  AND cmetadata->>'filename' IS NOT NULL
                ORDER BY filename
                """
            ),
            {"discord_id": discord_id},
        )
        filenames = [row[0] for row in result.fetchall()]

    return {"documents": filenames}


@app.delete("/documents/{filename}")
async def delete_document(
    filename: str,
    request: Request,
    discord_id: Annotated[str, Depends(get_caller_identity)],
):
    """
    Deletes all embedding chunks for the given filename belonging to this user.
    """
    async with engine.begin() as conn:
        await conn.execute(
            text(
                """
                DELETE FROM langchain_pg_embedding
                WHERE cmetadata->>'discord_id' = :discord_id
                  AND cmetadata->>'filename' = :filename
                """
            ),
            {"discord_id": discord_id, "filename": filename},
        )

    return {"status": "deleted", "filename": filename}


# OAuth 2 setup - Authorization Code Flow w/ PKCE
# https://docs.discord.com/developers/topics/oauth2
class OAuthRequest(BaseModel):
    code: str
    code_verifier: str   # for PKCE use -> original random verifier generated by frontend

@app.post("/auth/discord", responses={400: {"description": "Failed to authenticate with Discord."}})
async def authenticate_discord(request: OAuthRequest):
    """
    Exchanges the temporary Discord code + PKCE code_verifier for the user's
    profile data, then signs and returns a short-lived JWT.
    """
    client_id     = os.getenv("DISCORD_CLIENT_ID")
    client_secret = os.getenv("DISCORD_CLIENT_SECRET")
    redirect_uri  = os.getenv("DISCORD_REDIRECT_URI")

    token_data = {
        "client_id":     client_id,
        "client_secret": client_secret,
        "grant_type":    "authorization_code",
        "code":          request.code,
        "redirect_uri":  redirect_uri,
        "code_verifier": request.code_verifier,   # PKCE code
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

    discord_id = str(user_data["id"])
    username   = user_data["username"]
    avatar     = (
        f"https://cdn.discordapp.com/avatars/{user_data['id']}/{user_data['avatar']}.png"
        if user_data.get("avatar") else None
    )

    # Sign a JWT containing the user's Discord identity.
    # The frontend stores this and sends it as "Authorization: Bearer <token>"
    # on all subsequent API calls.
    now = datetime.now(tz=timezone.utc)
    app_token = jwt.encode(
        {
            "discord_id": discord_id,
            "username":   username,
            "avatar":     avatar,
            "iat":        now,
            "exp":        now + timedelta(hours=JWT_TTL_HOURS),
        },
        JWT_SECRET,
        algorithm="HS256",
    )

    return {
        "status": "success",
        "access_token": app_token,
        "user": {
            "discord_id": discord_id,
            "username":   username,
            "avatar":     avatar,
        },
    }


if __name__ == "__main__":
    uvicorn.run(app, host=os.getenv("HOST"), port=5000)