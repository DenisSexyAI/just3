# Transcriere Audio - Sistem Justiție

Aplicație pentru transcrierea automată a fișierelor audio din înregistrări judiciare folosind Google Gemini 2.5 Flash.

## Caracteristici

- **Transcriere automată** a fișierelor audio până la 3 ore
- **Identificarea vorbitorilor** cu timestamp-uri precise
- **Interfață modernă** cu drag & drop pentru încărcarea fișierelor
- **Procesare în segmente** pentru fișiere mari
- **Streaming progres** pentru feedback în timp real
- **Export transcriere** în format text
- **Optimizat pentru Vercel** cu timeout-uri extinse

## Tehnologii

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **AI**: Google Gemini 2.5 Flash
- **Audio Processing**: FFmpeg
- **Deployment**: Vercel

## Instalare

1. Clonează repository-ul:
```bash
git clone <repository-url>
cd speech-to-text-transcriber
```

2. Instalează dependențele:
```bash
npm install
```

3. Configurează variabilele de mediu:
```bash
cp .env.example .env.local
```

Editează `.env.local` și adaugă:
```
GEMINI_API_KEY=your_gemini_api_key_here
```

4. Rulează aplicația în development:
```bash
npm run dev
```

## Configurare pentru Vercel

1. Creează un proiect pe Vercel
2. Adaugă variabila de mediu `GEMINI_API_KEY` în setările proiectului
3. Deployează aplicația

### Configurare Vercel

Aplicația este configurată pentru a rula pe Vercel cu:
- Timeout extins la 5 minute pentru funcțiile serverless
- Optimizări pentru procesarea fișierelor mari
- Streaming pentru progres în timp real

## Utilizare

1. **Încarcă fișier audio**: Trage și plasează un fișier audio sau click pentru a selecta
2. **Formate suportate**: MP3, WAV, MP4, OGG, WEBM
3. **Dimensiune maximă**: 500MB
4. **Durată maximă**: 3 ore

### Procesul de transcriere

1. **Conversie audio**: Fișierul este convertit în format WAV compatibil
2. **Analiză durată**: Se detectează durata totală a audio-ului
3. **Împărțire în segmente**: Audio-ul este împărțit în segmente de 5 minute
4. **Transcriere cu AI**: Fiecare segment este procesat cu Gemini 2.5 Flash
5. **Identificare vorbitori**: AI-ul identifică și marchează vorbitorii diferiți
6. **Timestamp-uri**: Se generează timestamp-uri precise pentru fiecare segment

### Rezultate

- **Text transcris** cu timestamp-uri
- **Identificarea vorbitorilor** ([Vorbitor 1], [Vorbitor 2], etc.)
- **Export în format text** pentru descărcare
- **Căutare în transcriere** și filtrare după vorbitor
- **Statistici** (durată, vorbitori, cuvinte)

## API Endpoints

### POST /api/transcribe
Transcrie un fișier audio complet.

**Request:**
- `audio`: Fișier audio (FormData)

**Response:**
```json
{
  "id": "uuid",
  "fileName": "audio.mp3",
  "duration": 3600,
  "segments": [
    {
      "id": "segment-1",
      "startTime": 0,
      "endTime": 30,
      "text": "Text transcris",
      "speaker": "Vorbitor 1"
    }
  ],
  "status": "completed"
}
```

### POST /api/transcribe/stream
Transcrie cu streaming pentru progres în timp real.

**Response:** Stream cu mesaje de progres și rezultat final.

## Structura Proiectului

```
├── app/
│   ├── api/
│   │   └── transcribe/
│   │       ├── route.ts          # API principal
│   │       └── stream/
│   │           └── route.ts      # API streaming
│   ├── components/
│   │   ├── FileUpload.tsx        # Componentă upload
│   │   └── TranscriptionResult.tsx # Componentă rezultate
│   ├── globals.css               # Stiluri globale
│   ├── layout.tsx                # Layout principal
│   └── page.tsx                  # Pagină principală
├── public/                       # Fișiere statice
├── package.json                  # Dependențe
├── next.config.js               # Configurare Next.js
├── tailwind.config.js           # Configurare Tailwind
├── vercel.json                  # Configurare Vercel
└── README.md                    # Documentație
```

## Optimizări pentru Production

### Vercel
- **Timeout extins**: 5 minute pentru funcții serverless
- **Memory optimizat**: Pentru procesarea fișierelor mari
- **Streaming**: Pentru feedback în timp real

### Performanță
- **Împărțire în segmente**: Evită timeout-urile pentru fișiere mari
- **Procesare paralelă**: Segmentele sunt procesate independent
- **Curățare automată**: Fișierele temporare sunt șterse automat

### Securitate
- **Validare fișiere**: Tip și dimensiune
- **Sanitizare input**: Protecție împotriva fișierelor malicioase
- **API Key**: Stocat în variabile de mediu

## Limitări

- **Dimensiune maximă**: 500MB per fișier
- **Durată maximă**: 3 ore per fișier
- **Timeout Vercel**: 5 minute per request
- **Formate suportate**: MP3, WAV, MP4, OGG, WEBM

## Troubleshooting

### Erori comune

1. **"Tipul de fișier nu este suportat"**
   - Verifică că fișierul este în format audio suportat

2. **"Fișierul este prea mare"**
   - Reduce dimensiunea fișierului sub 500MB

3. **"Eroare la transcriere"**
   - Verifică că API key-ul Gemini este configurat corect
   - Verifică conexiunea la internet

4. **Timeout pe Vercel**
   - Fișierele foarte mari pot depăși timeout-ul de 5 minute
   - Încearcă cu un fișier mai mic

### Debug

1. Verifică log-urile în Vercel Dashboard
2. Testează cu fișiere mici mai întâi
3. Verifică configurarea variabilelor de mediu

## Contribuții

1. Fork repository-ul
2. Creează un branch pentru feature
3. Commit schimbările
4. Push la branch
5. Creează un Pull Request

## Licență

Acest proiect este licențiat sub MIT License.

## Suport

Pentru suport tehnic sau întrebări, deschide un issue în repository. 