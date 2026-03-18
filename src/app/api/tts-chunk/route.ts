import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

const VOICE_ID = 'XB0fDUnXU5powFXDhCwa';

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json() as { text: string };

    if (!text) {
      return NextResponse.json({ error: 'Texte manquant' }, { status: 400 });
    }

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
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
      throw new Error(`ElevenLabs: ${response.status} - ${error}`);
    }

    const audioBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(audioBuffer).toString('base64');

    return NextResponse.json({ audio: base64 });
  } catch (error) {
    console.error('Erreur tts-chunk:', error);
    return NextResponse.json({ error: 'Erreur TTS' }, { status: 500 });
  }
}
