import { NextRequest, NextResponse } from 'next/server';
import { fetchAllRSS } from '@/lib/rss';
import { classifyAndSummarize, generateAudioScript } from '@/lib/claude';
import { generateAudio } from '@/lib/elevenlabs';
import { sendDigestEmail } from '@/lib/resend-mail';

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[CRON] Début du digest hebdo...');

    // 1. Fetch RSS (7 derniers jours)
    const rawArticles = await fetchAllRSS(7);
    console.log(`[CRON] ${rawArticles.length} articles bruts`);

    if (rawArticles.length === 0) {
      return NextResponse.json({ message: 'Aucun article cette semaine' });
    }

    // 2. Classify & summarize via Claude
    const articles = await classifyAndSummarize(rawArticles);
    console.log(`[CRON] ${articles.length} articles classifiés`);

    // 3. Generate audio script + TTS
    console.log('[CRON] Génération audio...');
    const script = await generateAudioScript(articles);
    const audioUrl = await generateAudio(script);
    console.log(`[CRON] Audio: ${audioUrl}`);

    // 4. Send digest email
    console.log('[CRON] Envoi du mail...');
    await sendDigestEmail(articles, audioUrl);
    console.log('[CRON] Mail envoyé!');

    return NextResponse.json({
      success: true,
      articles: articles.length,
      audioUrl,
    });
  } catch (error) {
    console.error('[CRON] Erreur:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
