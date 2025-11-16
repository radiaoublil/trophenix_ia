import React, { useEffect, useRef, useState } from 'react'

const WIDTH = 1000
const HEIGHT = 400
const SHUFFLE = [1, 3, 0, 4, 2]

const defaultOpts = {
  smoothing: 0.6,
  fft: 8,
  minDecibels: -70,
  scale: 0.2,
  glow: 18,
  color1: [0, 230, 254],
  color2: [0, 180, 255],
  color3: [0, 120, 210],
  fillOpacity: 0.55,
  lineWidth: 1.2,
  blend: 'screen',
  shift: 42,
  width: 58,
  amp: 1.1
}

const cloneOpts = () => JSON.parse(JSON.stringify(defaultOpts))

export default function Recorder({ onReady }) {
  const [recording, setRecording] = useState(false)
  const [blobUrl, setBlobUrl] = useState(null)
  const [mediaSupported, setMediaSupported] = useState(true)
  const [name, setName] = useState('')

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const audioCtxRef = useRef(null)
  const analyserRef = useRef(null)
  const freqsRef = useRef(null)
  const vizFrameRef = useRef(null)

  const canvasRef = useRef(null)
  const canvasCtxRef = useRef(null)
  const optsRef = useRef(cloneOpts())
  const guiRef = useRef(null)

  useEffect(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMediaSupported(false)
    }

    setupGui()
    initCanvasContext()
    drawIdleLine()
    const onResize = () => {
      const isRecording = mediaRecorderRef.current?.state === 'recording'
      if (!isRecording) drawIdleLine()
    }
    window.addEventListener('resize', onResize)

    return () => {
      stop(true)
      destroyGui()
      window.removeEventListener('resize', onResize)
    }
  }, [])
  function initCanvasContext() {
    const canvas = canvasRef.current
    if (!canvas) return null
    if (!canvasCtxRef.current) {
      canvasCtxRef.current = canvas.getContext('2d')
    }
    return canvasCtxRef.current
  }

  function drawIdleLine() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = initCanvasContext()
    if (!ctx) return

    const width = canvas.clientWidth || WIDTH
    const height = canvas.clientHeight || HEIGHT
    canvas.width = width
    canvas.height = height
    ctx.clearRect(0, 0, width, height)

    const mid = height / 2
    const gradient = ctx.createLinearGradient(0, mid, width, mid)
    gradient.addColorStop(0, 'rgba(0,230,254,0)')
    gradient.addColorStop(0.3, 'rgba(0,230,254,0.45)')
    gradient.addColorStop(0.5, 'rgba(0,230,254,0.8)')
    gradient.addColorStop(0.7, 'rgba(0,230,254,0.45)')
    gradient.addColorStop(1, 'rgba(0,230,254,0)')

    ctx.beginPath()
    ctx.strokeStyle = gradient
    ctx.lineWidth = 2
    ctx.shadowColor = 'rgba(0,230,254,0.35)'
    ctx.shadowBlur = 18
    ctx.moveTo(0, mid)
    ctx.lineTo(width, mid)
    ctx.stroke()
  }

  async function setupGui() {
    if (guiRef.current) return
    try {
      const mod = await import('dat.gui')
      const GUI = mod.GUI || mod.default
      if (!GUI) return
      const gui = new GUI({ autoPlace: true })
      const opts = optsRef.current
      gui.addColor(opts, 'color1')
      gui.addColor(opts, 'color2')
      gui.addColor(opts, 'color3')
      gui.add(opts, 'fillOpacity', 0, 1)
      gui.add(opts, 'lineWidth', 0, 10).step(1)
      gui.add(opts, 'glow', 0, 100)
      gui.add(opts, 'blend', ['normal', 'multiply', 'screen', 'overlay', 'lighten', 'difference'])
      gui.add(opts, 'smoothing', 0, 1)
      gui.add(opts, 'minDecibels', -100, 0)
      gui.add(opts, 'amp', 0, 5)
      gui.add(opts, 'width', 0, 60)
      gui.add(opts, 'shift', 0, 200)
      gui.close()
      if (gui.domElement) gui.domElement.style.display = 'none'
      guiRef.current = gui
    } catch (err) {
      console.warn('dat.GUI n\'a pas pu etre charge', err)
    }
  }

  function destroyGui() {
    if (guiRef.current?.destroy) {
      guiRef.current.destroy()
    }
    guiRef.current = null
  }

  function range(count) {
    return Array.from({ length: count }, (_, i) => i)
  }

  function normalizedColor(value) {
    if (Array.isArray(value)) return value
    if (typeof value === 'string') {
      const hex = value.replace('#', '')
      const bigint = parseInt(hex, 16)
      const r = (bigint >> 16) & 255
      const g = (bigint >> 8) & 255
      const b = bigint & 255
      return [r, g, b]
    }
    return [255, 255, 255]
  }

  function freq(channel, i) {
    const freqs = freqsRef.current
    if (!freqs || !freqs.length) return 0
    const band = 2 * channel + SHUFFLE[i] * 6
    const idx = Math.max(0, Math.min(freqs.length - 1, band))
    return freqs[idx]
  }

  function scaleValue(i) {
    const x = Math.abs(2 - i)
    const s = 3 - x
    return (s / 3) * (optsRef.current.amp || 1)
  }

  function drawPath(channel, width, height) {
    const ctx = canvasCtxRef.current
    const opts = optsRef.current
    if (!ctx) return

    const color = normalizedColor(opts[`color${channel + 1}`]).map(Math.floor)
    ctx.fillStyle = `rgba(${color.join(',')}, ${opts.fillOpacity})`
    ctx.strokeStyle = ctx.shadowColor = `rgb(${color.join(',')})`
    ctx.lineWidth = opts.lineWidth
    ctx.shadowBlur = opts.glow
    ctx.globalCompositeOperation = opts.blend

    const mid = height / 2
    const offset = (width - 15 * opts.width) / 2
    const x = range(15).map(i => offset + channel * opts.shift + i * opts.width)
    const y = range(5).map(i => Math.max(0, mid - scaleValue(i) * freq(channel, i)))
    const h = height

    ctx.beginPath()
    ctx.moveTo(0, mid)
    ctx.lineTo(x[0], mid + 1)

    ctx.bezierCurveTo(x[1], mid + 1, x[2], y[0], x[3], y[0])
    ctx.bezierCurveTo(x[4], y[0], x[4], y[1], x[5], y[1])
    ctx.bezierCurveTo(x[6], y[1], x[6], y[2], x[7], y[2])
    ctx.bezierCurveTo(x[8], y[2], x[8], y[3], x[9], y[3])
    ctx.bezierCurveTo(x[10], y[3], x[10], y[4], x[11], y[4])

    ctx.bezierCurveTo(x[12], y[4], x[12], mid, x[13], mid)
    ctx.lineTo(width, mid + 1)
    ctx.lineTo(x[13], mid - 1)

    ctx.bezierCurveTo(x[12], mid, x[12], h - y[4], x[11], h - y[4])
    ctx.bezierCurveTo(x[10], h - y[4], x[10], h - y[3], x[9], h - y[3])
    ctx.bezierCurveTo(x[8], h - y[3], x[8], h - y[2], x[7], h - y[2])
    ctx.bezierCurveTo(x[6], h - y[2], x[6], h - y[1], x[5], h - y[1])
    ctx.bezierCurveTo(x[4], h - y[1], x[4], h - y[0], x[3], h - y[0])
    ctx.bezierCurveTo(x[2], h - y[0], x[1], mid, x[0], mid)
    ctx.lineTo(0, mid)

    ctx.fill()
    ctx.stroke()
  }

  function visualize() {
    const analyser = analyserRef.current
    const canvas = canvasRef.current
    const ctx = canvasCtxRef.current
    if (!analyser || !canvas || !ctx) return

    const opts = optsRef.current
    analyser.smoothingTimeConstant = opts.smoothing
    const fftSize = Math.pow(2, Math.round(opts.fft || 8))
    if (analyser.fftSize !== fftSize) analyser.fftSize = fftSize
    analyser.minDecibels = opts.minDecibels
    analyser.maxDecibels = 0

    const freqArraySize = analyser.frequencyBinCount
    if (!freqsRef.current || freqsRef.current.length !== freqArraySize) {
      freqsRef.current = new Uint8Array(freqArraySize)
    }
    analyser.getByteFrequencyData(freqsRef.current)

    const width = canvas.clientWidth || WIDTH
    const height = canvas.clientHeight || HEIGHT
    canvas.width = width
    canvas.height = height

    ctx.clearRect(0, 0, width, height)
    drawPath(0, width, height)
    drawPath(1, width, height)
    drawPath(2, width, height)

    vizFrameRef.current = requestAnimationFrame(visualize)
  }

  function resetVisualization() {
    cancelAnimationFrame(vizFrameRef.current)
    vizFrameRef.current = null
    const canvas = canvasRef.current
    const ctx = canvasCtxRef.current
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
    drawIdleLine()
  }

  async function start() {
    try {
      await setupGui()
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      const mr = new MediaRecorder(stream)
      mediaRecorderRef.current = mr
      chunksRef.current = []
      setBlobUrl(null)

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      }

      mr.onstop = () => {
        if (!chunksRef.current.length) return
        const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || 'audio/webm' })
        const url = URL.createObjectURL(blob)
        setBlobUrl(url)
      }

      mr.start()

      const AudioContext = window.AudioContext || window.webkitAudioContext
      const audioCtx = new AudioContext()
      audioCtxRef.current = audioCtx
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyserRef.current = analyser
      source.connect(analyser)

      const canvas = canvasRef.current
      if (canvas) {
        canvasCtxRef.current = canvas.getContext('2d')
      }

      visualize()
      setRecording(true)
      setMediaSupported(true)
    } catch (err) {
      console.error('Acces micro refuse ou erreur :', err)
      setMediaSupported(false)
      stop(true)
    }
  }

  function stop(silent = false) {
    const mr = mediaRecorderRef.current
    if (mr && mr.state !== 'inactive') {
      mr.stop()
      mr.stream?.getTracks?.forEach(t => t.stop())
    }
    resetVisualization()
    analyserRef.current = null
    freqsRef.current = null
    audioCtxRef.current?.close?.()
    audioCtxRef.current = null
    if (!silent) setRecording(false)
  }

  async function send() {
    if (!blobUrl) return
    const res = await fetch(blobUrl)
    const blob = await res.blob()

    let ext = 'webm'
    if (blob.type.includes('wav')) ext = 'wav'
    else if (blob.type.includes('ogg')) ext = 'ogg'
    else if (blob.type.includes('mpeg') || blob.type.includes('mp3')) ext = 'mp3'

    onReady(blob, `recording.${ext}`, name || 'Utilisateur')
  }

  function toggleRecording() {
    if (recording) {
      stop()
    } else {
      start()
    }
  }

  return (
    <div className="recorder">
      {!mediaSupported && <div className="error">Microphone non pris en charge ou acces refuse.</div>}

      <div className="visualizer-card full-width">
        <canvas id="canvas" ref={canvasRef} className="voice-canvas" aria-hidden></canvas>
      </div>

      <div className="voice-actions">
        <button
           className="voice-btn start"
           onClick={start}
           disabled={recording}
        >
           Commencer l'enregistrement
        </button>
        <button
           className="voice-btn stop"
           onClick={() => stop()}
           disabled={!recording}
        >
           Arrêter l'enregistrement
        </button>
      </div>
        <p className="label status-line">{recording ? 'Enregistrement en cours… appuyez sur arrêter pour terminer.' : 'Lancez l’enregistrement, parlez, puis arrêtez pour générer votre CV.'}</p>

      <label className="field" style={{ width: '100%', maxWidth: 560 }}>
        <span className="muted small">Nom (facultatif)</span>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Votre nom complet" />
      </label>

        <div className="controls audio-panel">
          {blobUrl ? (
            <>
              <audio controls src={blobUrl}></audio>
              <button className="button" onClick={send}>Envoyer et générer le CV</button>
            </>
          ) : (
            <p>Aucun enregistrement pour l’instant.</p>
          )}
        </div>
    </div>
  )
}

