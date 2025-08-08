# Instrucțiuni Deployment pe Vercel

## Pregătire pentru Deployment

### 1. Configurare API Key Gemini

1. Mergi la [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Creează un API key nou
3. Copiază cheia

### 2. Deployment pe Vercel

#### Opțiunea 1: Deploy direct din GitHub

1. Push codul pe GitHub
2. Mergi la [Vercel Dashboard](https://vercel.com/dashboard)
3. Click "New Project"
4. Importă repository-ul
5. Configurează variabilele de mediu:
   - `GEMINI_API_KEY`: Cheia ta Gemini API
6. Click "Deploy"

#### Opțiunea 2: Deploy din CLI

1. Instalează Vercel CLI:
```bash
npm i -g vercel
```

2. Login în Vercel:
```bash
vercel login
```

3. Deploy:
```bash
vercel
```

4. Configurează variabilele de mediu în Vercel Dashboard

### 3. Configurare Variabile de Mediu

În Vercel Dashboard, adaugă următoarele variabile:

```
GEMINI_API_KEY=your_gemini_api_key_here
NODE_ENV=production
```

### 4. Configurare Funcții Serverless

Aplicația este configurată pentru:
- **Timeout**: 5 minute per funcție
- **Memory**: Optimizat pentru procesarea fișierelor mari
- **Regions**: Auto-select pentru performanță optimă

### 5. Testare după Deployment

1. Accesează aplicația la URL-ul furnizat de Vercel
2. Testează cu un fișier audio mic (sub 1MB)
3. Verifică că transcrierea funcționează
4. Testează cu fișiere mai mari

## Optimizări pentru Production

### 1. Performance

- **CDN**: Vercel oferă CDN global automat
- **Edge Functions**: Pentru funcții rapide
- **Caching**: Configurat automat pentru fișiere statice

### 2. Monitoring

- **Vercel Analytics**: Pentru monitorizarea performanței
- **Logs**: Accesibile în Vercel Dashboard
- **Health Check**: Endpoint `/api/health` pentru monitoring

### 3. Scaling

- **Auto-scaling**: Vercel scalează automat
- **Concurrent requests**: Suportă multiple transcrieri simultane
- **Memory limits**: Optimizat pentru fișiere mari

## Troubleshooting

### Probleme comune

1. **Timeout errors**
   - Verifică că timeout-ul este setat la 5 minute
   - Reduce dimensiunea fișierelor de test

2. **Memory errors**
   - Verifică că fișierele nu depășesc 500MB
   - Testează cu fișiere mai mici

3. **API key errors**
   - Verifică că `GEMINI_API_KEY` este setat corect
   - Verifică că cheia este validă

4. **Build errors**
   - Verifică că toate dependențele sunt instalate
   - Verifică log-urile de build în Vercel

### Debug

1. **Vercel Logs**
   - Accesează Vercel Dashboard
   - Mergi la Functions
   - Verifică log-urile pentru erori

2. **Local Testing**
   - Testează local cu `npm run dev`
   - Verifică că toate funcționalitățile lucrează

3. **Health Check**
   - Accesează `/api/health` pentru status

## Costuri

### Vercel
- **Hobby Plan**: Gratuit pentru proiecte personale
- **Pro Plan**: $20/lună pentru proiecte comerciale
- **Enterprise**: Pentru organizații mari

### Gemini API
- **Cost per request**: ~$0.01-0.05 per transcriere
- **Quota**: Verifică limitele în Google AI Studio
- **Billing**: Configurat în Google Cloud Console

## Securitate

### Best Practices
1. **API Keys**: Niciodată în cod, doar în variabile de mediu
2. **File Validation**: Toate fișierele sunt validate
3. **Rate Limiting**: Configurat automat de Vercel
4. **HTTPS**: Forțat automat de Vercel

### Monitoring
1. **Error Tracking**: Vercel oferă tracking automat
2. **Performance Monitoring**: Built-in în Vercel
3. **Security Headers**: Configurate automat

## Suport

Pentru probleme tehnice:
1. Verifică [Vercel Documentation](https://vercel.com/docs)
2. Verifică [Next.js Documentation](https://nextjs.org/docs)
3. Deschide un issue în repository

Pentru probleme cu Gemini API:
1. Verifică [Google AI Documentation](https://ai.google.dev/docs)
2. Contactează suportul Google AI 