import { NextResponse } from 'next/server';
import { fetchAllRSS } from '@/lib/rss';
import { classifyAndSummarize } from '@/lib/claude';

export const maxDuration = 120;

export async function GET() {
  try {
    console.log('Fetching RSS feeds (7 derniers jours)...');
    const rawArticles = await fetchAllRSS(7);
    console.log(`${rawArticles.length} articles bruts récupérés`);

    if (rawArticles.length === 0) {
      return NextResponse.json({ articles: [], stats: { total: 0, red: 0, yellow: 0, green: 0 } });
    }

    console.log('Classification et résumé via Claude...');
    const articles = await classifyAndSummarize(rawArticles);
    console.log(`${articles.length} articles classifiés`);

    const stats = {
      total: articles.length,
      red: articles.filter((a) => a.scoreLevel === 'red').length,
      yellow: articles.filter((a) => a.scoreLevel === 'yellow').length,
      green: articles.filter((a) => a.scoreLevel === 'green').length,
    };

    return NextResponse.json({ articles, stats });
  } catch (error) {
    console.error('Erreur fetch-articles:', error);
    return NextResponse.json({ error: 'Erreur lors de la récupération des articles' }, { status: 500 });
  }
}
