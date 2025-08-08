import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { writeFile, unlink, mkdir } from 'fs/promises'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegStatic from 'ffmpeg-static'

// Configure FFmpeg
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic)
}

// Configure Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File

    if (!audioFile) {
      return NextResponse.json(
        { error: 'Nu s-a furnizat niciun fișier audio' },
        { status: 400 }
      )
    }

    // Verifică tipul fișierului
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/ogg', 'audio/webm']
    if (!allowedTypes.includes(audioFile.type)) {
      return NextResponse.json(
        { error: 'Tipul de fișier nu este suportat' },
        { status: 400 }
      )
    }

    // Verifică dimensiunea fișierului (max 500MB)
    const maxSize = 500 * 1024 * 1024 // 500MB
    if (audioFile.size > maxSize) {
      return NextResponse.json(
        { error: 'Fișierul este prea mare. Dimensiunea maximă este 500MB.' },
        { status: 400 }
      )
    }

    // Creează directorul temporar
    const tempDir = join(process.cwd(), 'tmp')
    try {
      await mkdir(tempDir, { recursive: true })
    } catch (error) {
      // Directorul există deja
    }

    // Salvează fișierul temporar
    const bytes = await audioFile.arrayBuffer()
    const buffer = Buffer.from(bytes)
    
    const fileName = `${uuidv4()}_${audioFile.name}`
    const filePath = join(tempDir, fileName)
    
    await writeFile(filePath, buffer)

    // Convertește audio-ul în format compatibil cu Gemini
    const convertedFilePath = await convertAudioToWav(filePath)
    
    // Obține durata audio-ului
    const duration = await getAudioDuration(convertedFilePath)
    
    // Împarte audio-ul în segmente pentru procesare
    const segments = await splitAudioIntoSegments(convertedFilePath, duration)
    
    // Procesează fiecare segment cu Gemini
    const transcriptionSegments = await processAudioSegments(segments)
    
    // Curăță fișierele temporare
    await cleanupTempFiles([filePath, convertedFilePath, ...segments.map(s => s.filePath)])

    const result = {
      id: uuidv4(),
      fileName: audioFile.name,
      duration: duration,
      segments: transcriptionSegments,
      status: 'completed' as const
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Eroare la transcriere:', error)
    return NextResponse.json(
      { error: 'Eroare la procesarea fișierului audio' },
      { status: 500 }
    )
  }
}

async function convertAudioToWav(inputPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const outputPath = inputPath.replace(/\.[^/.]+$/, '') + '_converted.wav'
    
    ffmpeg(inputPath)
      .toFormat('wav')
      .audioChannels(1)
      .audioFrequency(16000)
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(err))
      .save(outputPath)
  })
}

async function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err)
      } else {
        resolve(metadata.format.duration || 0)
      }
    })
  })
}

interface AudioSegment {
  filePath: string
  startTime: number
  endTime: number
}

async function splitAudioIntoSegments(filePath: string, duration: number): Promise<AudioSegment[]> {
  const segmentDuration = 300 // 5 minute per segment pentru a evita timeout-urile
  const segments: AudioSegment[] = []
  
  for (let startTime = 0; startTime < duration; startTime += segmentDuration) {
    const endTime = Math.min(startTime + segmentDuration, duration)
    const segmentPath = filePath.replace('.wav', `_segment_${startTime}_${endTime}.wav`)
    
    await new Promise<void>((resolve, reject) => {
      ffmpeg(filePath)
        .setStartTime(startTime)
        .setDuration(endTime - startTime)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .save(segmentPath)
    })
    
    segments.push({
      filePath: segmentPath,
      startTime,
      endTime
    })
  }
  
  return segments
}

async function processAudioSegments(segments: AudioSegment[]) {
  const transcriptionSegments: any[] = []
  let segmentIndex = 0
  
  for (const segment of segments) {
    try {
      // Convertește audio-ul în base64 pentru Gemini
      const audioBuffer = await readFileAsBase64(segment.filePath)
      
      // Folosește Gemini pentru transcriere
      const transcription = await transcribeWithGemini(audioBuffer, segment.startTime)
      
      // Adaugă segmentele la rezultat
      transcriptionSegments.push(...transcription)
      
      segmentIndex++
    } catch (error) {
      console.error(`Eroare la procesarea segmentului ${segmentIndex}:`, error)
      // Continuă cu următorul segment în caz de eroare
    }
  }
  
  return transcriptionSegments
}

async function readFileAsBase64(filePath: string): Promise<string> {
  const fs = await import('fs/promises')
  const buffer = await fs.readFile(filePath)
  return buffer.toString('base64')
}

async function transcribeWithGemini(audioBase64: string, startTimeOffset: number) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })
  
  const prompt = `
  Transcrie acest fișier audio din română. 
  Acesta este un audio din înregistrări judiciare.
  
  Te rog să:
  1. Transcrie textul exact din română
  2. Identifică vorbitorii diferiți și marchează-i cu [Vorbitor 1], [Vorbitor 2], etc.
  3. Furnizează timestamp-uri pentru fiecare segment
  4. Păstrează structura și formatul original al conversației
  5. Include și sunetele de fundal relevante (tuse, râsete, etc.) în paranteze
  
  Răspunde doar cu transcrierea, fără comentarii suplimentare.
  `

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        mimeType: 'audio/wav',
        data: audioBase64
      }
    }
  ])

  const response = await result.response
  const text = response.text()
  
  // Parsează răspunsul și creează segmente
  return parseTranscriptionResponse(text, startTimeOffset)
}

function parseTranscriptionResponse(text: string, startTimeOffset: number) {
  const segments: any[] = []
  const lines = text.split('\n').filter(line => line.trim())
  
  let currentTime = startTimeOffset
  let currentSpeaker = ''
  let currentText = ''
  
  for (const line of lines) {
    // Detectează timestamp-uri și vorbitori
    const timestampMatch = line.match(/\[?(\d{1,2}):(\d{2}):(\d{2})\]?/)
    const speakerMatch = line.match(/\[(Vorbitor \d+)\]/)
    
    if (timestampMatch) {
      // Salvează segmentul anterior
      if (currentText.trim()) {
        segments.push({
          id: `segment-${segments.length}`,
          startTime: currentTime,
          endTime: currentTime + 30, // Estimare
          text: currentText.trim(),
          speaker: currentSpeaker || undefined
        })
      }
      
      // Calculează timpul
      const hours = parseInt(timestampMatch[1])
      const minutes = parseInt(timestampMatch[2])
      const seconds = parseInt(timestampMatch[3])
      currentTime = startTimeOffset + hours * 3600 + minutes * 60 + seconds
      
      // Resetează pentru noul segment
      currentText = line.replace(timestampMatch[0], '').trim()
      currentSpeaker = ''
    } else if (speakerMatch) {
      currentSpeaker = speakerMatch[1]
      currentText += ' ' + line.replace(speakerMatch[0], '').trim()
    } else {
      currentText += ' ' + line.trim()
    }
  }
  
  // Adaugă ultimul segment
  if (currentText.trim()) {
    segments.push({
      id: `segment-${segments.length}`,
      startTime: currentTime,
      endTime: currentTime + 30,
      text: currentText.trim(),
      speaker: currentSpeaker || undefined
    })
  }
  
  return segments
}

async function cleanupTempFiles(filePaths: string[]) {
  for (const filePath of filePaths) {
    try {
      await unlink(filePath)
    } catch (error) {
      console.error(`Eroare la ștergerea fișierului ${filePath}:`, error)
    }
  }
} 