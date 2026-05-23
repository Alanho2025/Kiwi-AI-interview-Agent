FROM node:20-slim

# Install Azure Speech SDK dependencies and the optional open-source NLP runtime.
# libasound2 and ca-certificates are strictly required by the Microsoft Speech SDK C++ binaries on Linux.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libasound2 \
    ca-certificates \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

ENV VIRTUAL_ENV=/opt/kiwi-nlp-venv
ENV PATH="${VIRTUAL_ENV}/bin:${PATH}"
ENV SENTENCE_TRANSFORMER_MODEL=sentence-transformers/all-MiniLM-L6-v2
ENV SPACY_MODEL=en_core_web_sm

RUN python3 -m venv "$VIRTUAL_ENV"

WORKDIR /app

# Ensure cookies are configured for cross-origin (SameSite=None, Secure)
ENV NODE_ENV=production

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Install and warm optional NLP dependencies at build time so production requests do not pay first-load downloads.
COPY python/requirements.txt ./python/requirements.txt
RUN python -m pip install --no-cache-dir --upgrade pip \
    && python -m pip install --no-cache-dir -r ./python/requirements.txt \
    && python -m spacy download "$SPACY_MODEL" \
    && python -c "from sentence_transformers import SentenceTransformer; import os; SentenceTransformer(os.environ.get('SENTENCE_TRANSFORMER_MODEL', 'sentence-transformers/all-MiniLM-L6-v2'))"

# Copy application source
COPY . .

# Run the app
EXPOSE 8080
CMD ["npm", "start"]
