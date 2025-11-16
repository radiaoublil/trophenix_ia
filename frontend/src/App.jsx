import React, { useState } from 'react'
import Recorder from './Recorder'
import Logo from '/logo.png'

// Change this if your backend is hosted elsewhere
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000'

export default function App() {
  const [loading, setLoading] = useState(false)
  const [cvResult, setCvResult] = useState(null)
  const [error, setError] = useState(null)

  // Appeler quand un enregistrement est pret
  async function handleAudioReady(blob, filename = 'enregistrement.wav', name = 'Utilisateur') {
    setLoading(true)
    setError(null)
    setCvResult(null)

    try {
      // 1) Envoyer l'audio a `/transcribe_audio`
      const fd = new FormData()
      fd.append('audio', new File([blob], filename, { type: blob.type }))

      const tResp = await fetch(`${BACKEND_URL}/transcribe_audio`, {
        method: 'POST',
        body: fd,
      })

      if (!tResp.ok) {
        throw new Error(`Echec de la transcription : ${tResp.status} ${await tResp.text()}`)
      }

      const tJson = await tResp.json()
      const transcript = tJson.transcript || ''

      // 2) Envoyer le transcript vers le point de generation de CV
      const gResp = await fetch(`${BACKEND_URL}/generate_cv_from_text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ name, email: '', message: transcript })
      })

      if (!gResp.ok) {
        throw new Error(`Echec de la generation du CV : ${gResp.status} ${await gResp.text()}`)
      }

      const gJson = await gResp.json()
      setCvResult(gJson)

    } catch (err) {
      console.error(err)
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container text-center">
      <header className="app-header">
        <img src={Logo} alt="Trophasso" className="logo" />
        <h1 className="app-title">AGENT ELEA</h1>
        <span className="header-spacer" aria-hidden="true"></span>
      </header>

      <main>
        <Recorder onReady={handleAudioReady} />

        {loading && <div className="notice">Traitement en cours... merci de patienter</div>}
        {error && <div className="error">Erreur : {error}</div>}

        {cvResult && (
          <section className="cv-result">
            <h2>CV genere (JSON)</h2>
            <pre>{JSON.stringify(cvResult.cv_json || cvResult, null, 2)}</pre>

            {cvResult.cv_path && (
              <a className="button" href={cvResult.cv_path} target="_blank" rel="noreferrer">Telecharger le CV</a>
            )}
          </section>
        )}
      </main>

    </div>
  )
}
