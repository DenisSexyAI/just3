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
  const encoder = new TextEncoder()
  
  try {
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File

    if (!audioFile) {
      return new Response(
        encoder.encode(JSON.stringify({ error: 'Nu s-a furnizat niciun fișier audio' })),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Verifică tipul și dimensiunea fișierului
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/ogg', 'audio/webm']
    if (!allowedTypes.includes(audioFile.type)) {
      return new Response(
        encoder.encode(JSON.stringify({ error: 'Tipul de fișier nu este suportat' })),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const maxSize = 500 * 1024 * 1024 // 500MB
    if (audioFile.size > maxSize) {
      return new Response(
        encoder.encode(JSON.stringify({ error: 'Fișierul este prea mare. Dimensiunea maximă este 500MB.' })),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
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

    // Stream pentru progres
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Mesaj de progres - conversie audio
          controller.enqueue(encoder.encode(JSON.stringify({ 
            type: 'progress', 
            message: 'Se convertește audio-ul...',
            progress: 10 
          }) + '\n'))

          // Convertește audio-ul
          const convertedFilePath = await convertAudioToWav(filePath)
          
          controller.enqueue(encoder.encode(JSON.stringify({ 
            type: 'progress', 
            message: 'Se analizează durata audio...',
            progress: 20 
          }) + '\n'))

          // Obține durata
          const duration = await getAudioDuration(convertedFilePath)
          
          controller.enqueue(encoder.encode(JSON.stringify({ 
            type: 'progress', 
            message: `Durată detectată: ${formatTime(duration)}`,
            progress: 30 
          }) + '\n'))

          // Împarte în segmente
          controller.enqueue(encoder.encode(JSON.stringify({ 
            type: 'progress', 
            message: 'Se împart în segmente pentru procesare...',
            progress: 40 
          }) + '\n'))

          const segments = await splitAudioIntoSegments(convertedFilePath, duration)
          
          controller.enqueue(encoder.encode(JSON.stringify({ 
            type: 'progress', 
            message: `Audio împărțit în ${segments.length} segmente`,
            progress: 50 
          }) + '\n'))

          // Procesează segmentele
          const transcriptionSegments = []
          for (let i = 0; i < segments.length; i++) {
            const segment = segments[i]
            
            controller.enqueue(encoder.encode(JSON.stringify({ 
              type: 'progress', 
              message: `Se transcrie segmentul ${i + 1}/${segments.length}...`,
              progress: 50 + (i / segments.length) * 40 
            }) + '\n'))

            try {
              const audioBuffer = await readFileAsBase64(segment.filePath)
              const transcription = await transcribeWithGemini(audioBuffer, segment.startTime)
              transcriptionSegments.push(...transcription)
            } catch (error) {
              console.error(`Eroare la segmentul ${i}:`, error)
              // Continuă cu următorul segment
            }
          }

          // Curăță fișierele
          controller.enqueue(encoder.encode(JSON.stringify({ 
            type: 'progress', 
            message: 'Se curăță fișierele temporare...',
            progress: 95 
          }) + '\n'))

          await cleanupTempFiles([filePath, convertedFilePath, ...segments.map(s => s.filePath)])

          // Rezultat final
          const result = {
            type: 'complete',
            data: {
              id: uuidv4(),
              fileName: audioFile.name,
              duration: duration,
              segments: transcriptionSegments,
              status: 'completed'
            }
          }

          controller.enqueue(encoder.encode(JSON.stringify(result) + '\n'))
          controller.close()

        } catch (error) {
          console.error('Eroare în stream:', error)
          controller.enqueue(encoder.encode(JSON.stringify({ 
            type: 'error', 
            error: 'Eroare la procesarea fișierului audio' 
          }) + '\n'))
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })

  } catch (error) {
    console.error('Eroare la transcriere:', error)
    return new Response(
      encoder.encode(JSON.stringify({ error: 'Eroare la procesarea fișierului audio' })),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
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
  const segmentDuration = 300 // 5 minute per segment
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
  
  return parseTranscriptionResponse(text, startTimeOffset)
}

function parseTranscriptionResponse(text: string, startTimeOffset: number) {
  const segments: any[] = []
  const lines = text.split('\n').filter(line => line.trim())
  
  let currentTime = startTimeOffset
  let currentSpeaker = ''
  let currentText = ''
  
  for (const line of lines) {
    const timestampMatch = line.match(/\[?(\d{1,2}):(\d{2}):(\d{2})\]?/)
    const speakerMatch = line.match(/\[(Vorbitor \d+)\]/)
    
    if (timestampMatch) {
      if (currentText.trim()) {
        segments.push({
          id: `segment-${segments.length}`,
          startTime: currentTime,
          endTime: currentTime + 30,
          text: currentText.trim(),
          speaker: currentSpeaker || undefined
        })
      }
      
      const hours = parseInt(timestampMatch[1])
      const minutes = parseInt(timestampMatch[2])
      const seconds = parseInt(timestampMatch[3])
      currentTime = startTimeOffset + hours * 3600 + minutes * 60 + seconds
      
      currentText = line.replace(timestampMatch[0], '').trim()
      currentSpeaker = ''
    } else if (speakerMatch) {
      currentSpeaker = speakerMatch[1]
      currentText += ' ' + line.replace(speakerMatch[0], '').trim()
    } else {
      currentText += ' ' + line.trim()
    }
  }
  
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

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
} 