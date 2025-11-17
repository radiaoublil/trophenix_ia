import React, { useState } from 'react'
import Recorder from './Recorder'
import Logo from '/logo.png'

// Change this if your backend is hosted elsewhere
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000'

export default function App() {
  const [loading, setLoading] = useState(false)
  const [loadingStage, setLoadingStage] = useState(null)
  const [cvResult, setCvResult] = useState(null)
  const [error, setError] = useState(null)
  const [transcript, setTranscript] = useState('')
  const [pendingName, setPendingName] = useState('Utilisateur')
  const [email, setEmail] = useState('')
  const [view, setView] = useState('recorder') // 'recorder' | 'transcript' | 'cv-ready'

  // Appeler quand un enregistrement est pret
  async function handleAudioReady(blob, filename = 'enregistrement.wav', name = 'Utilisateur') {
    setLoading(true)
    setLoadingStage('transcription')
    setError(null)
    setCvResult(null)
    setTranscript('')
    setView('recorder')

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
      setTranscript(transcript)
      setPendingName(name || 'Utilisateur')
      setView('transcript')

    } catch (err) {
      console.error(err)
      setError(String(err))
    } finally {
      setLoading(false)
      setLoadingStage(null)
    }
  }

  async function handleGenerateCv() {
    if (!transcript.trim()) {
      setError('Le texte transcrit est vide. Modifiez-le ou relancez un enregistrement.')
      return
    }

    setLoading(true)
    setLoadingStage('cv')
    setError(null)
    setCvResult(null)

    try {
      const gResp = await fetch(`${BACKEND_URL}/generate_cv_from_text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ name: pendingName, email, message: transcript })
      })

      if (!gResp.ok) {
        throw new Error(`Echec de la generation du CV : ${gResp.status} ${await gResp.text()}`)
      }

      const gJson = await gResp.json()
      setCvResult(gJson)
      setView('cv-ready')

    } catch (err) {
      console.error(err)
      setError(String(err))
    } finally {
      setLoading(false)
      setLoadingStage(null)
    }
  }

  function renderRecorderView() {
    return (
      <>
        <Recorder onReady={handleAudioReady} isBusy={loading} />

        {error && view === 'recorder' && <div className="error">Erreur : {error}</div>}
      </>
    )
  }

  function handleReset() {
    setTranscript('')
    setCvResult(null)
    setError(null)
    setPendingName('Utilisateur')
    setEmail('')
    setView('recorder')
    setLoadingStage(null)
  }

  function renderTranscriptView() {
    return (
      <section className="transcript-page">
        <div className="transcript-page-head">
          <p className="muted">Transcription prête</p>
          <h2>Etape 2 — Vérifiez et ajustez la transcription avant de générer le CV.</h2>
        </div>

        <div className="transcript-fields">
          <label>
            <span>Nom</span>
            <input value={pendingName} onChange={e => setPendingName(e.target.value)} />
          </label>
          <label>
            <span>Email</span>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="optionnel" />
          </label>
        </div>

        <textarea
          className="transcript-editor"
          value={transcript}
          onChange={e => setTranscript(e.target.value)}
        />

        {loading && <div className="notice">Génération du CV en cours...</div>}
        {error && <div className="error">Erreur : {error}</div>}

        <div className="transcript-actions">
          <button className="button ghost back-button" onClick={handleReset} disabled={loading}>
            Revenir à l'enregistrement
          </button>
          <button className="button" onClick={handleGenerateCv} disabled={loading}>
            Valider et générer le CV
          </button>
        </div>
      </section>
    )
  }

  function renderCvReadyView() {
    if (!cvResult) return renderRecorderView()

    return (
      <section className="cv-ready">
        <p className="muted">Votre transcription a été envoyée avec succès.</p>
        <h2>Votre CV est prêt</h2>
        <p className="muted">Téléchargez le document généré ou recommencez un enregistrement.</p>
        {cvResult.cv_path ? (
          <a className="button download" href={cvResult.cv_path} target="_blank" rel="noreferrer">
            Télécharger le CV
          </a>
        ) : (
          <pre>{JSON.stringify(cvResult.cv_json || cvResult, null, 2)}</pre>
        )}
        <button className="button ghost" onClick={() => { setView('recorder'); setTranscript(''); setCvResult(null); }}>
          Générer un autre CV
        </button>
      </section>
    )
  }

  return (
    <div className="container text-center">
      <header className="app-header">
        <img src={Logo} alt="Trophasso" className="logo" />
        <h1 className="app-title">AGENT ELEA</h1>
        <span className="header-spacer" aria-hidden="true"></span>
      </header>

      <main>
        {view === 'cv-ready' && renderCvReadyView()}
        {view === 'transcript' && renderTranscriptView()}
        {view === 'recorder' && renderRecorderView()}
      </main>

      {loading && <LoadingOverlay stage={loadingStage} />}

    </div>
  )
}

function LoadingOverlay({ stage }) {
  const message = stage === 'cv'
    ? 'Génération du CV en cours...'
    : stage === 'transcription'
      ? 'Analyse de l\'audio en cours...'
      : 'Chargement...'

  return (
    <div className="loading-overlay" role="status" aria-live="polite">
      <div className="loading-box">
        <span className="loading-spinner" aria-hidden="true"></span>
        <p>{message}</p>
      </div>
    </div>
  )
}
