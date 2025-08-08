import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

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

    // Verifică dimensiunea fișierului (max 50MB pentru Vercel)
    const maxSize = 50 * 1024 * 1024 // 50MB
    if (audioFile.size > maxSize) {
      return NextResponse.json(
        { error: 'Fișierul este prea mare. Dimensiunea maximă este 50MB pentru Vercel.' },
        { status: 400 }
      )
    }

    // Verifică că API key-ul este setat
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY nu este configurat' },
        { status: 500 }
      )
    }

    // Convertește fișierul în base64
    const bytes = await audioFile.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const audioBase64 = buffer.toString('base64')

    // Transcrie cu Gemini
    const transcription = await transcribeWithGemini(audioBase64, audioFile.name)

    const result = {
      id: `transcription-${Date.now()}`,
      fileName: audioFile.name,
      duration: transcription.duration || 0,
      segments: transcription.segments,
      status: 'completed' as const
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Eroare la transcriere:', error)
    return NextResponse.json(
      { error: 'Eroare la procesarea fișierului audio: ' + error.message },
      { status: 500 }
    )
  }
}

async function transcribeWithGemini(audioBase64: string, fileName: string) {
  try {
    // Încearcă cu modelul standard
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
    
    const prompt = `
    Transcrie acest fișier audio din română. 
    Acesta este un audio din înregistrări judiciare.
    
    Te rog să:
    1. Transcrie textul exact din română
    2. Identifică vorbitorii diferiți și marchează-i cu [Vorbitor 1], [Vorbitor 2], etc.
    3. Furnizează timestamp-uri pentru fiecare segment în format [MM:SS]
    4. Păstrează structura și formatul original al conversației
    5. Include și sunetele de fundal relevante (tuse, râsete, etc.) în paranteze
    
    Răspunde doar cu transcrierea, fără comentarii suplimentare.
    `

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: 'audio/mpeg',
          data: audioBase64
        }
      }
    ])

    const response = await result.response
    const text = response.text()
    
    return parseTranscriptionResponse(text, fileName)
  } catch (error) {
    console.error('Eroare cu Gemini:', error)
    
    // Încearcă cu modelul alternativ dacă primul eșuează
    try {
      const model2 = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' })
      
      const result2 = await model2.generateContent([
        'Transcrie acest fișier audio din română. Răspunde doar cu transcrierea.',
        {
          inlineData: {
            mimeType: 'audio/mpeg',
            data: audioBase64
          }
        }
      ])

      const response2 = await result2.response
      const text2 = response2.text()
      
      return parseTranscriptionResponse(text2, fileName)
    } catch (error2) {
      console.error('Eroare cu modelul alternativ:', error2)
      throw new Error('Eroare la transcrierea cu Gemini: ' + error.message)
    }
  }
}

function parseTranscriptionResponse(text: string, fileName: string) {
  const segments: any[] = []
  const lines = text.split('\n').filter(line => line.trim())
  
  let currentTime = 0
  let currentSpeaker = ''
  let currentText = ''
  let segmentIndex = 0
  
  for (const line of lines) {
    const timestampMatch = line.match(/\[?(\d{1,2}):(\d{2})\]?/)
    const speakerMatch = line.match(/\[(Vorbitor \d+)\]/)
    
    if (timestampMatch) {
      if (currentText.trim()) {
        segments.push({
          id: `segment-${segmentIndex}`,
          startTime: currentTime,
          endTime: currentTime + 30,
          text: currentText.trim(),
          speaker: currentSpeaker || undefined
        })
        segmentIndex++
      }
      
      const minutes = parseInt(timestampMatch[1])
      const seconds = parseInt(timestampMatch[2])
      currentTime = minutes * 60 + seconds
      
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
      id: `segment-${segmentIndex}`,
      startTime: currentTime,
      endTime: currentTime + 30,
      text: currentText.trim(),
      speaker: currentSpeaker || undefined
    })
  }
  
  const duration = segments.length > 0 ? Math.max(...segments.map(s => s.endTime)) : 0
  
  return {
    segments,
    duration
  }
}
