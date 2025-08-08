'use client'

import { useState } from 'react'
import { Download, Play, Pause, Clock, Users, FileAudio, AlertCircle, CheckCircle } from 'lucide-react'
import { TranscriptionResult as TranscriptionResultType } from '../page'

interface TranscriptionResultProps {
  transcription: TranscriptionResultType
  onPlayAudio: (audioUrl: string, startTime: number) => void
  onPauseAudio: () => void
  onDownload: (transcription: TranscriptionResultType) => void
  isPlaying: boolean
  currentTime: number
}

export default function TranscriptionResult({
  transcription,
  onPlayAudio,
  onPauseAudio,
  onDownload,
  isPlaying,
  currentTime
}: TranscriptionResultProps) {
  const [expanded, setExpanded] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>('all')

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getSpeakers = () => {
    const speakers = new Set(transcription.segments.map(s => s.speaker).filter(Boolean))
    return Array.from(speakers)
  }

  const filteredSegments = transcription.segments.filter(segment => {
    const matchesSearch = segment.text.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesSpeaker = selectedSpeaker === 'all' || segment.speaker === selectedSpeaker
    return matchesSearch && matchesSpeaker
  })

  const getStatusIcon = () => {
    switch (transcription.status) {
      case 'processing':
        return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      default:
        return null
    }
  }

  const getStatusText = () => {
    switch (transcription.status) {
      case 'processing':
        return 'Se procesează...'
      case 'completed':
        return 'Completat'
      case 'error':
        return 'Eroare'
      default:
        return 'Necunoscut'
    }
  }

  const handleSegmentClick = (startTime: number) => {
    // Simulează un URL audio pentru demo
    const audioUrl = `/api/audio/${transcription.id}`
    onPlayAudio(audioUrl, startTime)
  }

  if (transcription.status === 'error') {
    return (
      <div className="card border-red-200 bg-red-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <div>
              <h3 className="font-medium text-red-900">{transcription.fileName}</h3>
              <p className="text-sm text-red-700">{transcription.error}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <FileAudio className="w-5 h-5 text-primary-600" />
          <div>
            <h3 className="font-medium text-gray-900">{transcription.fileName}</h3>
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <span className="flex items-center space-x-1">
                <Clock className="w-4 h-4" />
                <span>{formatTime(transcription.duration)}</span>
              </span>
              <span className="flex items-center space-x-1">
                <Users className="w-4 h-4" />
                <span>{getSpeakers().length} vorbitori</span>
              </span>
              <span className="flex items-center space-x-1">
                {getStatusIcon()}
                <span>{getStatusText()}</span>
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onDownload(transcription)}
            className="btn-secondary flex items-center space-x-1"
          >
            <Download className="w-4 h-4" />
            <span>Descarcă</span>
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="btn-secondary"
          >
            {expanded ? 'Ascunde' : 'Arată'} Detalii
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && transcription.status === 'completed' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-64">
              <input
                type="text"
                placeholder="Caută în transcriere..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            
            <select
              value={selectedSpeaker}
              onChange={(e) => setSelectedSpeaker(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="all">Toți vorbitorii</option>
              {getSpeakers().map(speaker => (
                <option key={speaker} value={speaker}>
                  {speaker}
                </option>
              ))}
            </select>
          </div>

          {/* Segments */}
          <div className="max-h-96 overflow-y-auto space-y-3">
            {filteredSegments.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                Nu s-au găsit rezultate pentru căutarea curentă.
              </p>
            ) : (
              filteredSegments.map((segment) => (
                <div
                  key={segment.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    currentTime >= segment.startTime && currentTime <= segment.endTime
                      ? 'bg-primary-50 border-primary-200'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                  onClick={() => handleSegmentClick(segment.startTime)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {segment.speaker && (
                        <div className="inline-block px-2 py-1 bg-primary-100 text-primary-700 text-xs font-medium rounded mb-1">
                          {segment.speaker}
                        </div>
                      )}
                      <p className="text-gray-900">{segment.text}</p>
                    </div>
                    <div className="ml-4 text-sm text-gray-500">
                      {formatTime(segment.startTime)} - {formatTime(segment.endTime)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">Sumar</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Segmente:</span>
                <span className="ml-2 font-medium">{filteredSegments.length}</span>
              </div>
              <div>
                <span className="text-gray-500">Vorbitori:</span>
                <span className="ml-2 font-medium">{getSpeakers().length}</span>
              </div>
              <div>
                <span className="text-gray-500">Durată:</span>
                <span className="ml-2 font-medium">{formatTime(transcription.duration)}</span>
              </div>
              <div>
                <span className="text-gray-500">Cuvinte:</span>
                <span className="ml-2 font-medium">
                  {filteredSegments.reduce((total, s) => total + s.text.split(' ').length, 0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 