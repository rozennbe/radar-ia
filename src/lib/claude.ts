import Anthropic from '@anthropic-ai/sdk';
import { Article, Category, getScoreLevel } from './types';
import { RawArticle } from './rss';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface ClassifiedArticle {
  index: number;
  title: string;
  summary: string;
  category: Category;
  score: number;
}

export async function classifyAndSummarize(articles: RawArticle[]): Promise<Article[]> {
  // Process in batches of 10
  const batchSize = 10;
  const allResults: Article[] = [];

  for (let i = 0; i < articles.length; i += batchSize) {
    const batch = articles.slice(i, i + batchSize);
    const batchResults = await processBatch(batch);
    allResults.push(...batchResults);
  }

  return allResults.sort((a, b) => b.score - a.score);
}

async function processBatch(articles: RawArticle[]): Promise<Article[]> {
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

ARTICLES :
${articlesText}

Retourne UNIQUEMENT un JSON array (pas de markdown, pas de commentaires) :
[{"index": 0, "summary": "...", "category": "...", "score": 7}, ...]`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    // Extract JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array found');

    const classified: ClassifiedArticle[] = JSON.parse(jsonMatch[0]);

    return classified.map((c) => {
      const original = articles[c.index];
      if (!original) return null;
      const score = Math.min(10, Math.max(1, c.score));
      return {
        id: Buffer.from(original.url || original.title).toString('base64').slice(0, 20),
        title: original.title,
        url: original.url,
        source: original.source,
        sourceType: 'rss' as const,
        publishedAt: original.publishedAt,
        rawContent: original.content,
        summary: c.summary,
        category: c.category as Category,
        score,
        scoreLevel: getScoreLevel(score),
      };
    }).filter(Boolean) as Article[];
  } catch (error) {
    console.error('Erreur Claude:', error);
    // Fallback: return articles without AI processing
    return articles.map((a) => ({
      id: Buffer.from(a.url || a.title).toString('base64').slice(0, 20),
      title: a.title,
      url: a.url,
      source: a.source,
      sourceType: 'rss' as const,
      publishedAt: a.publishedAt,
      rawContent: a.content,
      summary: a.content.slice(0, 200),
      category: 'Outils grand public' as Category,
      score: 5,
      scoreLevel: 'yellow' as const,
    }));
  }
}

export async function generateAudioScript(articles: Article[]): Promise<string> {
  const relevant = articles.filter((a) => a.scoreLevel === 'red' || a.scoreLevel === 'yellow');

  const byCategory = relevant.reduce((acc, a) => {
    if (!acc[a.category]) acc[a.category] = [];
    acc[a.category].push(a);
    return acc;
  }, {} as Record<string, Article[]>);

  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const articlesList = Object.entries(byCategory)
    .map(([cat, arts]) => {
      const artTexts = arts.map((a) => `- "${a.title}" (source : ${a.source}, score ${a.score}/10) : ${a.summary}`).join('\n');
      return `Catégorie ${cat} :\n${artTexts}`;
    })
    .join('\n\n');

  const prompt = `Tu es une animatrice de podcast IA, voix posée et dynamique. Génère un script audio de 15 minutes pour le résumé hebdomadaire de veille IA.

Date : semaine du ${today}
Nombre d'articles : ${relevant.length}

Articles par catégorie :
${articlesList}

FORMAT DU SCRIPT :
1. Introduction (30 sec) : "Bonjour et bienvenue dans le Radar IA, votre veille hebdomadaire sur l'intelligence artificielle. Semaine du ${today}, ${relevant.length} actus passées au crible."
2. Pour chaque catégorie : transition naturelle, puis résumé détaillé de chaque article avec contexte, analyse et implications. Développe plus que le résumé écrit — c'est un format podcast, tu as le temps.
3. Entre les catégories : transitions fluides ("Passons maintenant à...", "Côté...", "Et pour finir...")
4. Conclusion (1 min) : synthèse des 3 actus les plus impactantes de la semaine + "À la semaine prochaine sur le Radar IA !"

TON : professionnel mais accessible, comme France Culture version tech. Pas de "euh", pas de remplissage.

IMPORTANT : Le script doit faire environ 3000-4000 mots pour remplir 15 minutes de lecture audio.

Retourne UNIQUEMENT le script, prêt à être lu par un TTS.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }],
  });

  return response.content[0].type === 'text' ? response.content[0].text : '';
}
