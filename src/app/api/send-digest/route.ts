import { NextRequest, NextResponse } from 'next/server';
import { sendDigestEmail } from '@/lib/resend-mail';
import { Article } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const { articles, audioUrl } = await request.json() as { articles: Article[]; audioUrl?: string };

    if (!articles || articles.length === 0) {
      return NextResponse.json({ error: 'Aucun article fourni' }, { status: 400 });
    }

    console.log('Envoi du digest par mail...');
    const result = await sendDigestEmail(articles, audioUrl);
    console.log('Mail envoyé:', result);

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Erreur send-digest:', error);
    return NextResponse.json({ error: 'Erreur lors de l\'envoi du mail' }, { status: 500 });
  }
}
