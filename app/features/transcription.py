import whisper

MODEL_NAME = "tiny"
model = whisper.load_model(MODEL_NAME)

def transcribe_audio(path):
    print("⏳ Transcription en cours...")
    result = model.transcribe(path, language="fr")
    return result["text"]
