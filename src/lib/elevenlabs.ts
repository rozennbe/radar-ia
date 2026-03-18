import { put } from '@vercel/blob';

const API_KEY = process.env.ELEVENLABS_API_KEY;
const BASE_URL = 'https://api.elevenlabs.io/v1';

const VOICE_ID = 'XB0fDUnXU5powFXDhCwa'; // Charlotte - voix féminine française

export async function generateAudio(script: string): Promise<string> {
  const chunks = splitText(script, 4500);
  const audioBuffers: Buffer[] = [];

  for (const chunk of chunks) {
    const response = await fetch(`${BASE_URL}/text-to-speech/${VOICE_ID}`, {
      method: 'POST',
      headers: {
        'xi-api-key': API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: chunk,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ElevenLabs error: ${response.status} - ${error}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    audioBuffers.push(buffer);
  }

  const combined = Buffer.concat(audioBuffers);
  const filename = `radar-ia-${new Date().toISOString().split('T')[0]}.mp3`;

  // Upload to Vercel Blob (works in prod) or fallback to filesystem (dev)
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(filename, combined, {
      access: 'public',
      contentType: 'audio/mpeg',
    });
    return blob.url;
  } else {
    // Dev fallback: write to public/audio
    const fs = await import('fs');
    const path = await import('path');
    const filepath = path.join(process.cwd(), 'public', 'audio', filename);
    fs.writeFileSync(filepath, combined);
    return `/audio/${filename}`;
  }
}

function splitText(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  let current = '';

  for (const sentence of sentences) {
    if ((current + ' ' + sentence).length > maxLength && current.length > 0) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current = current ? current + ' ' + sentence : sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}
