FROM python:3.13-slim

WORKDIR /app

# AI MANDATE: Robust ML Environment
# Prophet requires build tools (gcc, g++, etc.) to compile dependencies like pystan/cmdstan.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["python", "main.py"]
