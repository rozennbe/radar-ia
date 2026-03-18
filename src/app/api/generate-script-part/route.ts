import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 60;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface PartRequest {
  part: 'intro' | 'category' | 'conclusion';
  date: string;
  totalArticles: number;
  categoryName?: string;
  articles?: { title: string; source: string; summary: string; score: number }[];
  topArticles?: { title: string; summary: string }[];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as PartRequest;
    let prompt = '';

    if (body.part === 'intro') {
      prompt = `Ecris UNIQUEMENT l'introduction (4-5 phrases) d'un podcast de veille IA hebdomadaire.
Date : semaine du ${body.date}. ${body.totalArticles} actualites passees au crible.
Commence par "Bonjour et bienvenue dans le Radar IA".
Annonce les themes de la semaine.
Ton : professionnel mais accessible, comme France Culture version tech.
Retourne UNIQUEMENT le texte, pret pour un TTS.`;
    } else if (body.part === 'category' && body.categoryName && body.articles) {
      const artList = body.articles.map(a => `- "${a.title}" (${a.source}, score ${a.score}/10) : ${a.summary}`).join('\n');
      prompt = `Ecris la section "${body.categoryName}" d'un podcast de veille IA hebdomadaire.
Commence par une transition naturelle vers cette categorie.
Developpe chaque article avec contexte et implications (3-4 phrases par article).

Articles :
${artList}

Ton : professionnel mais accessible, direct, percutant. Pas de remplissage.
Retourne UNIQUEMENT le texte, pret pour un TTS. Pas de titres ni de markdown.`;
    } else if (body.part === 'conclusion' && body.topArticles) {
      const topList = body.topArticles.map(a => `- "${a.title}" : ${a.summary}`).join('\n');
      prompt = `Ecris UNIQUEMENT la conclusion (5-6 phrases) d'un podcast de veille IA hebdomadaire.
Synthetise les 3 actus les plus impactantes :
${topList}
Termine par "A la semaine prochaine sur le Radar IA !"
Ton : professionnel, dynamique.
Retourne UNIQUEMENT le texte, pret pour un TTS.`;
    } else {
      return NextResponse.json({ error: 'Parametres invalides' }, { status: 400 });
    }

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    return NextResponse.json({ text });
  } catch (error) {
    console.error('Erreur generate-script-part:', error);
    return NextResponse.json({ error: 'Erreur generation script' }, { status: 500 });
  }
}
