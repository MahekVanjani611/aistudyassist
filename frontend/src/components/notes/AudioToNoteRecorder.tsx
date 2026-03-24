'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { Mic, Square, Wand2, X } from 'lucide-react'

declare global {
  interface Window {
    SpeechRecognition?: any
    webkitSpeechRecognition?: any
  }
}

interface AudioToNoteRecorderProps {
  onClose: () => void
  onApply: (payload: { title: string; contentHtml: string; summary?: string }) => void
}

export function AudioToNoteRecorder({ onClose, onApply }: AudioToNoteRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [titleHint, setTitleHint] = useState('')
  const [error, setError] = useState('')

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recognitionRef = useRef<any>(null)

  const stopTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }

  const stopRecognition = () => {
    try {
      recognitionRef.current?.stop?.()
    } catch {
      // ignore
    }
    recognitionRef.current = null
  }

  const startRecording = async () => {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder

      recorder.onstop = () => {
        stopTracks()
      }

      recorder.start()
      setIsRecording(true)

      // Free browser speech-to-text (best effort)
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (!SpeechRecognition) {
        setError('Speech recognition is not available in this browser. Please use Chrome/Edge.')
        return
      }

      const recognition = new SpeechRecognition()
      recognitionRef.current = recognition
      recognition.lang = 'en-US'
      recognition.continuous = true
      recognition.interimResults = true

      recognition.onresult = (event: any) => {
        let interim = ''
        let finalText = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const text = event.results[i][0].transcript
          if (event.results[i].isFinal) finalText += text + ' '
          else interim += text
        }
        if (finalText) {
          setTranscript((prev) => (prev + ' ' + finalText).trim())
        }
      }

      recognition.onerror = (_e: any) => {
        setError('Speech recognition had an issue. You can still edit transcript manually.')
      }

      recognition.onend = () => {
        if (isRecording) {
          try {
            recognition.start()
          } catch {
            // ignore auto-restart failures
          }
        }
      }

      recognition.start()
    } catch (e) {
      setError('Could not access microphone. Please allow microphone permission.')
      setIsRecording(false)
      stopTracks()
      stopRecognition()
    }
  }

  const stopRecording = () => {
    setIsRecording(false)
    try {
      mediaRecorderRef.current?.stop()
    } catch {
      // ignore
    }
    mediaRecorderRef.current = null
    stopRecognition()
    stopTracks()
  }

  const handleGenerateNote = async () => {
    if (!transcript.trim()) {
      setError('Transcript is empty. Record some audio first.')
      return
    }

    setIsGenerating(true)
    setError('')
    try {
      const result = await api.transcriptToNote(transcript, titleHint || undefined)
      onApply({
        title: result.title,
        contentHtml: result.content_html,
        summary: result.summary,
      })
      onClose()
    } catch (e: any) {
      setError(e?.message || 'Failed to generate note from transcript')
    } finally {
      setIsGenerating(false)
    }
  }

  useEffect(() => {
    return () => {
      stopRecording()
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl rounded-xl border border-gray-200 dark:border-[#232a36] bg-white dark:bg-[#141820] p-4 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Audio to Notes (free transcription)</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2 mb-3">
          {!isRecording ? (
            <Button onClick={startRecording} className="bg-orange-500 hover:bg-orange-600 text-white">
              <Mic className="h-4 w-4 mr-2" /> Start Recording
            </Button>
          ) : (
            <Button onClick={stopRecording} variant="destructive">
              <Square className="h-4 w-4 mr-2" /> Stop Recording
            </Button>
          )}
          <span className="text-sm text-gray-600 dark:text-gray-300">
            {isRecording ? 'Recording and transcribing...' : 'Press start and speak clearly'}
          </span>
        </div>

        <input
          value={titleHint}
          onChange={(e) => setTitleHint(e.target.value)}
          placeholder="Optional title hint (e.g., Calculus Lecture 5)"
          className="w-full mb-3 px-3 py-2 rounded-md border border-gray-200 dark:border-[#232a36] bg-white dark:bg-[#0f1115] text-gray-900 dark:text-gray-100"
        />

        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Transcript will appear here... You can edit before generating notes."
          className="w-full h-64 px-3 py-2 rounded-md border border-gray-200 dark:border-[#232a36] bg-white dark:bg-[#0f1115] text-gray-900 dark:text-gray-100"
        />

        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleGenerateNote}
            disabled={isGenerating || !transcript.trim()}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            <Wand2 className="h-4 w-4 mr-2" />
            {isGenerating ? 'Generating note...' : 'Generate Note with Gemini'}
          </Button>
        </div>
      </div>
    </div>
  )
}
