FROM python:3.12-slim
ENV PIP_NO_CACHE_DIR=1 PYTHONUNBUFFERED=1 HF_HOME=/models MMS_LANGS=khm
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /srv
COPY requirements.txt .
RUN pip install torch --index-url https://download.pytorch.org/whl/cpu && pip install -r requirements.txt
# Bake the model weights into the image so cold starts are fast and offline.
RUN python -c "import os; from transformers import VitsModel, AutoTokenizer; [ (VitsModel.from_pretrained(f'facebook/mms-tts-{l}'), AutoTokenizer.from_pretrained(f'facebook/mms-tts-{l}')) for l in os.environ['MMS_LANGS'].split(',') ]"
COPY app.py .
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')" || exit 1
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
