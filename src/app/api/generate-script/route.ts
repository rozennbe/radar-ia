import { NextRequest, NextResponse } from 'next/server';
import { generateAudioScript } from '@/lib/claude';
import { Article } from '@/lib/types';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { articles } = await request.json() as { articles: Article[] };

    if (!articles || articles.length === 0) {
      return NextResponse.json({ error: 'Aucun article fourni' }, { status: 400 });
    }

    const script = await generateAudioScript(articles);
    return NextResponse.json({ script });
  } catch (error) {
    console.error('Erreur generate-script:', error);
    return NextResponse.json({ error: 'Erreur lors de la génération du script' }, { status: 500 });
  }
}
