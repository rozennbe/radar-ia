import { NextResponse } from 'next/server';
import { fetchAllRSS } from '@/lib/rss';

export const maxDuration = 60;

export async function GET() {
  try {
    const rawArticles = await fetchAllRSS(7);
    return NextResponse.json({ articles: rawArticles });
  } catch (error) {
    console.error('Erreur fetch-rss:', error);
    return NextResponse.json({ error: 'Erreur lors de la récupération RSS' }, { status: 500 });
  }
}
