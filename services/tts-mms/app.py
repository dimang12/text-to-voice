"""Self-hosted text-to-speech using Meta's MMS-TTS models (VITS).

POST /synthesize  {"text": "...", "lang": "khm", "speed": 1.0, "format": "mp3"}
GET  /health

License note: MMS models are released under CC BY-NC 4.0 (non-commercial).
"""

import io
import os
import re
import subprocess
import threading

import numpy as np
import torch
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field
from transformers import AutoTokenizer, VitsModel

LANGS = [l.strip() for l in os.environ.get("MMS_LANGS", "khm").split(",") if l.strip()]
MAX_CHARS = int(os.environ.get("MMS_MAX_CHARS", "6000"))
MIME = {"mp3": "audio/mpeg", "wav": "audio/wav", "opus": "audio/ogg", "aac": "audio/aac", "flac": "audio/flac"}
FFMPEG_ARGS = {
    "mp3": ["-codec:a", "libmp3lame", "-b:a", "96k", "-f", "mp3"],
    "wav": ["-codec:a", "pcm_s16le", "-f", "wav"],
    "opus": ["-codec:a", "libopus", "-b:a", "64k", "-f", "ogg"],
    "aac": ["-codec:a", "aac", "-b:a", "96k", "-f", "adts"],
    "flac": ["-codec:a", "flac", "-f", "flac"],
}
SENTENCE_SPLIT = re.compile(r"(?<=[។៕?!\.])\s*")

torch.set_num_threads(max(1, os.cpu_count() or 1))
app = FastAPI(title="mms-tts")
_lock = threading.Lock()
_models: dict[str, tuple[VitsModel, AutoTokenizer, object | None]] = {}


def load(lang: str):
    if lang in _models:
        return _models[lang]
    name = f"facebook/mms-tts-{lang}"
    model = VitsModel.from_pretrained(name).eval()
    tokenizer = AutoTokenizer.from_pretrained(name)
    romanizer = None
    if getattr(tokenizer, "is_uroman", False):
        import uroman

        romanizer = uroman.Uroman()
    _models[lang] = (model, tokenizer, romanizer)
    return _models[lang]


@app.on_event("startup")
def warm():
    for lang in LANGS:
        load(lang)


class SynthRequest(BaseModel):
    text: str = Field(min_length=1, max_length=20000)
    lang: str = "khm"
    speed: float = Field(default=1.0, ge=0.5, le=2.0)
    format: str = "mp3"


def split_text(text: str) -> list[str]:
    parts = [p.strip() for p in SENTENCE_SPLIT.split(text.replace("\r\n", "\n")) if p.strip()]
    chunks: list[str] = []
    for p in parts:
        while len(p) > 600:
            cut = p.rfind(" ", 0, 600)
            cut = cut if cut > 200 else 600
            chunks.append(p[:cut].strip())
            p = p[cut:].strip()
        if p:
            chunks.append(p)
    return chunks or [text.strip()]


def synthesize(text: str, lang: str, speed: float) -> tuple[np.ndarray, int]:
    model, tokenizer, romanizer = load(lang)
    sr = model.config.sampling_rate
    pieces: list[np.ndarray] = []
    gap = np.zeros(int(sr * 0.25), dtype=np.float32)
    with _lock:
        model.speaking_rate = speed
        for chunk in split_text(text):
            src = romanizer.romanize_string(chunk) if romanizer else chunk
            inputs = tokenizer(src, return_tensors="pt")
            if inputs["input_ids"].shape[-1] == 0:
                continue
            with torch.no_grad():
                wav = model(**inputs).waveform[0].cpu().numpy().astype(np.float32)
            pieces.append(wav)
            pieces.append(gap)
    if not pieces:
        raise HTTPException(status_code=400, detail="Nothing to speak after tokenisation")
    audio = np.concatenate(pieces[:-1])
    peak = float(np.max(np.abs(audio))) or 1.0
    return (audio / peak * 0.95), sr


def encode(audio: np.ndarray, sr: int, fmt: str) -> bytes:
    pcm = (audio * 32767).astype(np.int16).tobytes()
    cmd = ["ffmpeg", "-loglevel", "error", "-f", "s16le", "-ar", str(sr), "-ac", "1", "-i", "pipe:0", *FFMPEG_ARGS[fmt], "pipe:1"]
    out = subprocess.run(cmd, input=pcm, capture_output=True, check=False)
    if out.returncode != 0:
        raise HTTPException(status_code=500, detail=out.stderr.decode(errors="ignore")[:300])
    return out.stdout


@app.get("/health")
def health():
    return {"ok": True, "langs": list(_models.keys())}


@app.post("/synthesize")
def synth(req: SynthRequest):
    if req.lang not in LANGS:
        raise HTTPException(status_code=400, detail=f"Language {req.lang} is not loaded")
    if req.format not in FFMPEG_ARGS:
        raise HTTPException(status_code=400, detail="Unsupported format")
    if len(req.text) > MAX_CHARS:
        raise HTTPException(status_code=413, detail=f"Text over {MAX_CHARS} characters")
    audio, sr = synthesize(req.text, req.lang, req.speed)
    data = encode(audio, sr, req.format)
    seconds = round(len(audio) / sr, 2)
    return Response(content=data, media_type=MIME[req.format], headers={"X-Duration-Seconds": str(seconds)})
