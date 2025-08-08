'use client'

import { useState, useRef } from 'react'
import { Upload, FileAudio, Clock, Users, Download, Play, Pause } from 'lucide-react'
import TranscriptionResult from './components/TranscriptionResult'
import FileUpload from './components/FileUpload'

export interface TranscriptionSegment {
  id: string
  startTime: number
  endTime: number
  text: string
  speaker?: string
}

export interface TranscriptionResult {
  id: string
  fileName: string
  duration: number
  segments: TranscriptionSegment[]
  status: 'processing' | 'completed' | 'error'
  error?: string
}

export default function Home() {
  const [transcriptions, setTranscriptions] = useState<TranscriptionResult[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)

  const handleFileUpload = async (file: File) => {
    const formData = new FormData()
    formData.append('audio', file)

    const transcriptionId = `transcription-${Date.now()}`
    
    // Adaugă o înregistrare temporară pentru a afișa progresul
    const tempTranscription: TranscriptionResult = {
      id: transcriptionId,
      fileName: file.name,
      duration: 0,
      segments: [],
      status: 'processing'
    }
    
    setTranscriptions(prev => [tempTranscription, ...prev])
    setIsProcessing(true)

    try {
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Eroare la transcriere')
      }

      const result = await response.json()
      
      setTranscriptions(prev => 
        prev.map(t => 
          t.id === transcriptionId 
            ? { ...result, status: 'completed' as const }
            : t
        )
      )
    } catch (error) {
      console.error('Eroare:', error)
      setTranscriptions(prev => 
        prev.map(t => 
          t.id === transcriptionId 
            ? { ...t, status: 'error', error: error instanceof Error ? error.message : 'Eroare necunoscută' }
            : t
        )
      )
    } finally {
      setIsProcessing(false)
    }
  }

  const handlePlayAudio = (audioUrl: string, startTime: number = 0) => {
    if (currentAudio) {
      currentAudio.pause()
      currentAudio.currentTime = 0
    }

    const audio = new Audio(audioUrl)
    audio.currentTime = startTime
    audio.play()
    setCurrentAudio(audio)
    setIsPlaying(true)

    audio.addEventListener('timeupdate', () => {
      setCurrentTime(audio.currentTime)
    })

    audio.addEventListener('ended', () => {
      setIsPlaying(false)
      setCurrentTime(0)
    })
  }

  const handlePauseAudio = () => {
    if (currentAudio) {
      currentAudio.pause()
      setIsPlaying(false)
    }
  }

  const handleDownloadTranscription = (transcription: TranscriptionResult) => {
    const content = transcription.segments.map(segment => {
      const startTime = formatTime(segment.startTime)
      const endTime = formatTime(segment.endTime)
      const speaker = segment.speaker ? `[${segment.speaker}]` : ''
      return `[${startTime} - ${endTime}] ${speaker} ${segment.text}`
    }).join('\n\n')

    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${transcription.fileName.replace(/\.[^/.]+$/, '')}_transcription.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Transcriere Audio - Sistem Justiție
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Încarcă fișiere audio din înregistrări judiciare pentru transcriere automată cu timestamp-uri și identificarea vorbitorilor
          </p>
        </div>

        {/* File Upload Section */}
        <div className="card mb-8">
          <FileUpload 
            onFileUpload={handleFileUpload}
            isProcessing={isProcessing}
          />
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card text-center">
            <div className="flex items-center justify-center mb-2">
              <FileAudio className="w-8 h-8 text-primary-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900">
              {transcriptions.length}
            </h3>
            <p className="text-gray-600">Fișiere procesate</p>
          </div>
          
          <div className="card text-center">
            <div className="flex items-center justify-center mb-2">
              <Clock className="w-8 h-8 text-primary-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900">
              {transcriptions.reduce((total, t) => total + t.duration, 0).toFixed(1)}h
            </h3>
            <p className="text-gray-600">Timp total transcris</p>
          </div>
          
          <div className="card text-center">
            <div className="flex items-center justify-center mb-2">
              <Users className="w-8 h-8 text-primary-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900">
              {transcriptions.reduce((total, t) => {
                const speakers = new Set(t.segments.map(s => s.speaker).filter(Boolean))
                return total + speakers.size
              }, 0)}
            </h3>
            <p className="text-gray-600">Vorbitori identificați</p>
          </div>
        </div>

        {/* Transcription Results */}
        {transcriptions.length > 0 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Rezultate Transcriere
            </h2>
            
            {transcriptions.map((transcription) => (
              <TranscriptionResult
                key={transcription.id}
                transcription={transcription}
                onPlayAudio={handlePlayAudio}
                onPauseAudio={handlePauseAudio}
                onDownload={handleDownloadTranscription}
                isPlaying={isPlaying}
                currentTime={currentTime}
              />
            ))}
          </div>
        )}

        {/* Audio Controls */}
        {currentAudio && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
            <div className="container mx-auto max-w-6xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={isPlaying ? handlePauseAudio : () => handlePlayAudio('', currentTime)}
                    className="btn-primary"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <span className="text-sm text-gray-600">
                    {formatTime(currentTime)}
                  </span>
                </div>
                <div className="flex-1 mx-4">
                  <input
                    type="range"
                    min="0"
                    max={currentAudio.duration || 0}
                    value={currentTime}
                    onChange={(e) => {
                      const time = parseFloat(e.target.value)
                      setCurrentTime(time)
                      if (currentAudio) {
                        currentAudio.currentTime = time
                      }
                    }}
                    className="w-full"
                  />
                </div>
                <span className="text-sm text-gray-600">
                  {formatTime(currentAudio.duration || 0)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 