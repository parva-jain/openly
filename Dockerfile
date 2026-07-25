# Python AI service image.
# Slim base keeps the image small. We install deps first (their own layer) so
# Docker caches them and only re-runs pip when requirements.txt changes.
FROM python:3.10-slim

WORKDIR /app

# Install runtime deps (not the dev/test tools).
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy only what the service needs to run.
COPY openly ./openly

EXPOSE 8000

# Bind 0.0.0.0 (not localhost) so the server is reachable from OUTSIDE the
# container — localhost inside a container only means the container itself.
CMD ["uvicorn", "openly.api:app", "--host", "0.0.0.0", "--port", "8000"]
