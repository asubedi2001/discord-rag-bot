# build stage
FROM python:3.12-slim AS builder

WORKDIR /app

# install build dependencies (needed for some native extensions, e.g. asyncpg)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# copy only the dependency manifest first for better layer caching
COPY requirements.txt .

# install into a prefix we can copy cleanly to the final stage
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt


# runtime stage
FROM python:3.12-slim AS runtime

# create a non-root user for security
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser

WORKDIR /app

# runtime system lib required by psycopg / asyncpg (libpq)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# pull in the installed packages from the build stage
COPY --from=builder /install /usr/local

# copy application source
COPY main.py .

# huggingface will cache model weights here; volume-mount this in production
ENV HF_HOME=/app/.cache/huggingface
RUN mkdir -p /app/.cache && chown -R appuser:appgroup /app

USER appuser

# FastAPI + uvicorn listens on port 5000 (matches main.py)
EXPOSE 5000

# use exec form so signals reach the python process (enables graceful shutdown)
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5000"]
