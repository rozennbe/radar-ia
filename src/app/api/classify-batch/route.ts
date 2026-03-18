import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { Category, getScoreLevel } from '@/lib/types';

export const maxDuration = 60;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface RawArticle {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    const { articles } = await request.json() as { articles: RawArticle[] };

    if (!articles || articles.length === 0) {
      return NextResponse.json({ articles: [] });
    }

    const articlesText = articles
      .map((a, i) => `[${i}] Titre: ${a.title}\nSource: ${a.source}\nContenu: ${a.content.slice(0, 800)}`)
      .join('\n\n---\n\n');

    const prompt = `Tu es une experte IA qui fait de la veille pour une consultante Sopra Steria Next spécialisée en IA appliquée aux secteurs santé, transport, marketing/CRM, et éducation. Elle est aussi entrepreneuse (éducation, entrepreneuriat féminin).

Analyse ces ${articles.length} articles et pour chacun retourne un JSON.

CATÉGORIES (une seule par article) :
1. "Santé & IA" — hôpitaux, cliniques, pharma, diagnostic, données de santé
2. "Transport & mobilité" — ferroviaire, aérien, logistique, mobilité
3. "Marketing & CRM" — acquisition, fidélisation, personnalisation, SEO/SEA
4. "Outils grand public" — nouvelles applis, mises à jour de modèles, productivité
5. "Éducation & IA" — edtech, apprentissage, formation, pédagogie

SCORE DE PERTINENCE (1-10) :
- Impact direct métier (40%) : concerne ses secteurs clients ou projets perso ?
- Nouveauté (30%) : annonce, lancement, première ? Testable immédiatement ?
- Potentiel réutilisation (30%) : citable en RDV client, post LinkedIn, formation ?

TON DES RÉSUMÉS : Direct, piquant, sans jargon. Comme une collègue experte qui te briefe en 30 sec. 2-3 phrases max.

TITRE : Traduis TOUJOURS le titre en français. Si le titre original est en anglais, traduis-le de façon naturelle et percutante.

ARTICLES :
${articlesText}

Retourne UNIQUEMENT un JSON array (pas de markdown, pas de commentaires) :
[{"index": 0, "title": "Titre en français", "summary": "...", "category": "...", "score": 7}, ...]`;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array found');

    const classified = JSON.parse(jsonMatch[0]);

    const result = classified.map((c: { index: number; title: string; summary: string; category: string; score: number }) => {
      const original = articles[c.index];
      if (!original) return null;
      const score = Math.min(10, Math.max(1, c.score));
      return {
        id: Buffer.from(original.url || original.title).toString('base64').slice(0, 20),
        title: c.title || original.title,
        url: original.url,
        source: original.source,
        sourceType: 'rss',
        publishedAt: original.publishedAt,
        rawContent: original.content,
        summary: c.summary,
        category: c.category as Category,
        score,
        scoreLevel: getScoreLevel(score),
      };
    }).filter(Boolean);

    return NextResponse.json({ articles: result });
  } catch (error) {
    console.error('Erreur classify-batch:', error);
    return NextResponse.json({ error: 'Erreur classification' }, { status: 500 });
  }
}
