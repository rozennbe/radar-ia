import { NextRequest, NextResponse } from 'next/server';
import { generateAudioScript } from '@/lib/claude';
import { generateAudio } from '@/lib/elevenlabs';
import { Article } from '@/lib/types';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const { articles } = await request.json() as { articles: Article[] };

    if (!articles || articles.length === 0) {
      return NextResponse.json({ error: 'Aucun article fourni' }, { status: 400 });
    }

    console.log('Génération du script audio via Claude...');
    const script = await generateAudioScript(articles);
    console.log(`Script généré : ${script.length} caractères`);

    console.log('Synthèse vocale via ElevenLabs...');
    const audioUrl = await generateAudio(script);
    console.log(`Audio généré : ${audioUrl}`);

    return NextResponse.json({ audioUrl, script });
  } catch (error) {
    console.error('Erreur generate-audio:', error);
    return NextResponse.json({ error: 'Erreur lors de la génération audio' }, { status: 500 });
  }
}
