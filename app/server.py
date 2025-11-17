from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os, csv, tempfile
from datetime import datetime
from app.features.transcription import transcribe_audio
from app.features.gemini_service import generate_cv_json
from app.features.cv_generator import generate_cv_doc

LOG_PATH = "data/test_logs.csv"

app = FastAPI(title="CV Generator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPPORTED_TYPES = {
    "audio/wav",
    "audio/x-wav",
    "audio/mpeg",    
    "audio/mp4",      
    "audio/ogg",
    "audio/webm",    
    "video/mp4"     
}

# === Endpoint de transcription ===
@app.post("/transcribe_audio")
async def transcribe_audio_endpoint(audio: UploadFile = File(...)):
    """Reçoit un audio et retourne la transcription brute (sans correction)"""
    if audio.content_type not in SUPPORTED_TYPES:
        raise HTTPException(400, "Format audio non supporté")

    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(audio.filename)[1]) as tmp:
        tmp.write(await audio.read())
        tmp_path = tmp.name

    try:
        transcription = transcribe_audio(tmp_path)
        return {"transcript": transcription}
    except Exception as e:
        raise HTTPException(500, f"Erreur lors de la transcription : {e}")
    finally:
        os.remove(tmp_path)


# === Endpoint de génération du CV ===
@app.post("/generate_cv_from_text")
async def generate_cv_from_text(
    name: str = Form(...),
    email: str = Form(...),
    message: str = Form(...)
):
    """Reçoit un texte (corrigé ou non), génère le CV, et loggue le test utilisateur"""
    try:
        cv_data = generate_cv_json(message)
        cv_path = generate_cv_doc(cv_data, output_dir="data/output")

        os.makedirs("data", exist_ok=True)
        with open(LOG_PATH, "a", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([datetime.now(), name, email, "from_text", cv_path])

        return {
            "cv_json": cv_data,
            "cv_path": cv_path
        }

    except Exception as e:
        raise HTTPException(500, f"Erreur serveur : {e}")
