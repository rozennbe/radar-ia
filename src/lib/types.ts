export interface Article {
  id: string;
  title: string;
  url: string;
  source: string;
  sourceType: 'rss' | 'twitter' | 'newsletter';
  publishedAt: string;
  rawContent: string;
  summary: string;
  category: Category;
  score: number;
  scoreLevel: 'red' | 'yellow' | 'green';
}

export type Category =
  | 'Santé & IA'
  | 'Transport & mobilité'
  | 'Marketing & CRM'
  | 'Outils grand public'
  | 'Éducation & IA';

export const CATEGORIES: Category[] = [
  'Santé & IA',
  'Transport & mobilité',
  'Marketing & CRM',
  'Outils grand public',
  'Éducation & IA',
];

export function getScoreLevel(score: number): 'red' | 'yellow' | 'green' {
  if (score >= 8) return 'red';
  if (score >= 5) return 'yellow';
  return 'green';
}
