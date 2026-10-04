'use client'

import { useEffect, useRef, useState } from 'react'

type Recognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: unknown) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}

/**
 * A microphone button that appends transcribed speech to a text field.
 *
 * Uses the browser's own Web Speech API — audio never leaves the device as
 * audio. Only the transcript (identical in shape to typed text) reaches the
 * app, through the same input the keyboard writes to. Firefox and some
 * browsers do not implement this API at all, so the button quietly does not
 * render there rather than offering something broken.
 */
export default function VoiceInput({
  onTranscript,
  disabled,
}: {
  onTranscript: (text: string) => void
  disabled?: boolean
}) {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<Recognition | null>(null)

  useEffect(() => {
    const Ctor =
      (window as unknown as { SpeechRecognition?: new () => Recognition }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => Recognition })
        .webkitSpeechRecognition

    if (!Ctor) {
      return
    }

    // Speech support is only knowable in the browser, after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(true)
    const recognition = new Ctor()
    recognition.lang = navigator.language || 'en-US'
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onresult = (event) => {
      const results = (event as { results: { transcript: string }[][] }).results
      const transcript = Array.from(results)
        .map((result) => result[0]?.transcript ?? '')
        .join(' ')
        .trim()

      if (transcript) {
        onTranscript(transcript)
      }
    }

    recognition.onend = () => setListening(false)
    recognition.onerror = () => setListening(false)

    recognitionRef.current = recognition

    return () => recognition.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!supported) {
    return null
  }

  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={listening}
      aria-label={listening ? 'Stop listening' : 'Speak instead of typing'}
      title={listening ? 'Stop listening' : 'Speak instead of typing'}
      onClick={() => {
        if (listening) {
          recognitionRef.current?.stop()
          setListening(false)
          return
        }

        setListening(true)
        recognitionRef.current?.start()
      }}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors ${
        listening
          ? 'border-red-300 bg-red-50 text-red-600'
          : 'border-ink-200 bg-white text-ink-500 hover:bg-ink-50'
      }`}
    >
      {listening ? (
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" aria-hidden />
      ) : (
        <span aria-hidden>🎙️</span>
      )}
    </button>
  )
}
