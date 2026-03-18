'use client';

import { Article } from '@/lib/types';

const CATEGORY_COLORS: Record<string, string> = {
  'Santé & IA': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'Transport & mobilité': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Marketing & CRM': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'Outils grand public': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  'Éducation & IA': 'bg-pink-500/20 text-pink-400 border-pink-500/30',
};

const SCORE_INDICATORS: Record<string, { emoji: string; bg: string }> = {
  red: { emoji: '🔴', bg: 'border-red-500/50' },
  yellow: { emoji: '🟡', bg: 'border-yellow-500/50' },
  green: { emoji: '🟢', bg: 'border-green-500/50' },
};

export function ArticleCard({ article }: { article: Article }) {
  const catColor = CATEGORY_COLORS[article.category] || 'bg-gray-500/20 text-gray-400';
  const scoreInfo = SCORE_INDICATORS[article.scoreLevel];

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`block p-5 rounded-xl bg-white/5 border ${scoreInfo.bg} hover:bg-white/10 transition-all duration-200 group`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="text-white font-semibold text-base leading-tight group-hover:text-blue-400 transition-colors flex-1">
          {article.title}
        </h3>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-lg">{scoreInfo.emoji}</span>
          <span className="text-xs text-gray-400 font-mono">{article.score}/10</span>
        </div>
      </div>

      <p className="text-gray-400 text-sm leading-relaxed mb-3">{article.summary}</p>

      <div className="flex items-center gap-3 flex-wrap">
        <span className={`text-xs px-2.5 py-1 rounded-full border ${catColor}`}>
          {article.category}
        </span>
        <span className="text-xs text-gray-500">{article.source}</span>
        <span className="text-xs text-gray-600">
          {new Date(article.publishedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
        </span>
      </div>
    </a>
  );
}
