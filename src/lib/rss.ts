import RSSParser from 'rss-parser';

const parser = new RSSParser();

export const RSS_FEEDS = [
  { name: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
  { name: 'The Verge AI', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml' },
  { name: 'OpenAI Blog', url: 'https://openai.com/news/rss.xml' },
  { name: 'Anthropic Blog', url: 'https://www.anthropic.com/rss.xml' },
  { name: 'Google AI Blog', url: 'https://research.google/blog/rss' },
  { name: 'VentureBeat AI', url: 'https://venturebeat.com/category/ai/feed/' },
  { name: 'Ars Technica AI', url: 'https://feeds.arstechnica.com/arstechnica/technology-lab' },
  { name: 'One Useful Thing', url: 'https://www.oneusefulthing.org/feed' },
  { name: 'The Batch', url: 'https://www.deeplearning.ai/the-batch/feed' },
  { name: "L'Usine Digitale", url: 'https://www.usine-digitale.fr/rss' },
  { name: 'Maddyness', url: 'https://www.maddyness.com/feed/' },
  { name: 'Siècle Digital', url: 'https://siecledigital.fr/feed/' },
];

export interface RawArticle {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  content: string;
}

export async function fetchAllRSS(daysBack: number = 7): Promise<RawArticle[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);

  const results = await Promise.allSettled(
    RSS_FEEDS.map(async (feed) => {
      try {
        const parsed = await parser.parseURL(feed.url);
        return (parsed.items || [])
          .filter((item) => {
            const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
            return pubDate >= cutoffDate;
          })
          .map((item) => ({
            title: item.title || 'Sans titre',
            url: item.link || '',
            source: feed.name,
            publishedAt: item.pubDate || new Date().toISOString(),
            content: (item.contentSnippet || item.content || item.title || '').slice(0, 2000),
          }));
      } catch (error) {
        console.error(`Erreur RSS ${feed.name}:`, error);
        return [];
      }
    })
  );

  return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
}
