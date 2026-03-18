'use client';

import { useState } from 'react';
import { Article, CATEGORIES, Category } from '@/lib/types';
import { ArticleCard } from '@/components/ArticleCard';
import { AudioPlayer } from '@/components/AudioPlayer';

interface Stats {
  total: number;
  red: number;
  yellow: number;
  green: number;
}

export default function Home() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, red: 0, yellow: 0, green: 0 });
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category | 'all'>('all');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchArticles = async () => {
    setLoading(true);
    setError(null);
    setLoadingProgress('Recuperation des flux RSS...');
    try {
      // Step 1: Fetch raw RSS articles
      const rssRes = await fetch('/api/fetch-rss');
      if (!rssRes.ok) throw new Error(`Erreur RSS: ${rssRes.status}`);
      const rssText = await rssRes.text();
      let rssData;
      try { rssData = JSON.parse(rssText); } catch { throw new Error('Reponse RSS invalide'); }
      if (rssData.error) throw new Error(rssData.error);
      const rawArticles = rssData.articles;
      setLoadingProgress(`${rawArticles.length} articles trouves. Classification en cours...`);

      // Step 2: Classify in batches of 5 (small to avoid Vercel 10s timeout)
      const batchSize = 5;
      const allArticles: Article[] = [];

      for (let i = 0; i < rawArticles.length; i += batchSize) {
        const batch = rawArticles.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(rawArticles.length / batchSize);
        setLoadingProgress(`Analyse ${batchNum}/${totalBatches}...`);

        try {
          const classRes = await fetch('/api/classify-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ articles: batch }),
          });
          if (!classRes.ok) {
            console.warn(`Batch ${batchNum} failed (${classRes.status}), skipping`);
            continue;
          }
          const text = await classRes.text();
          const classData = JSON.parse(text);
          if (classData.error) {
            console.warn(`Batch ${batchNum} error: ${classData.error}, skipping`);
            continue;
          }
          allArticles.push(...classData.articles);
        } catch (batchErr) {
          console.warn(`Batch ${batchNum} exception, skipping:`, batchErr);
          continue;
        }
      }

      // Sort by score
      allArticles.sort((a, b) => b.score - a.score);
      setArticles(allArticles);
      setStats({
        total: allArticles.length,
        red: allArticles.filter((a) => a.scoreLevel === 'red').length,
        yellow: allArticles.filter((a) => a.scoreLevel === 'yellow').length,
        green: allArticles.filter((a) => a.scoreLevel === 'green').length,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
      setLoadingProgress('');
    }
  };

  const splitText = (text: string, maxLen: number): string[] => {
    const chunks: string[] = [];
    const sentences = text.split(/(?<=[.!?])\s+/);
    let current = '';
    for (const s of sentences) {
      if ((current + ' ' + s).length > maxLen && current.length > 0) {
        chunks.push(current.trim());
        current = s;
      } else {
        current = current ? current + ' ' + s : s;
      }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks;
  };

  const callApi = async (url: string, body: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Erreur ${res.status}`);
    const text = await res.text();
    try { return JSON.parse(text); } catch { throw new Error('Reponse invalide du serveur'); }
  };

  const handleGenerateAudio = async () => {
    setGeneratingAudio(true);
    setError(null);
    try {
      const relevant = articles.filter(a => a.scoreLevel === 'red' || a.scoreLevel === 'yellow');
      const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

      // Group by category
      const byCategory: Record<string, typeof relevant> = {};
      for (const a of relevant) {
        if (!byCategory[a.category]) byCategory[a.category] = [];
        byCategory[a.category].push(a);
      }
      const categories = Object.keys(byCategory);

      // Step 1: Generate script parts sequentially
      const scriptParts: string[] = [];

      setAudioProgress('Script: introduction...');
      const introData = await callApi('/api/generate-script-part', {
        part: 'intro', date: today, totalArticles: relevant.length,
      });
      scriptParts.push((introData as { text: string }).text);

      for (let i = 0; i < categories.length; i++) {
        const cat = categories[i];
        setAudioProgress(`Script: ${cat} (${i + 1}/${categories.length})...`);
        const catData = await callApi('/api/generate-script-part', {
          part: 'category',
          categoryName: cat,
          articles: byCategory[cat].map(a => ({ title: a.title, source: a.source, summary: a.summary, score: a.score })),
        });
        scriptParts.push((catData as { text: string }).text);
      }

      setAudioProgress('Script: conclusion...');
      const topArticles = relevant.slice(0, 3).map(a => ({ title: a.title, summary: a.summary }));
      const concData = await callApi('/api/generate-script-part', {
        part: 'conclusion', topArticles,
      });
      scriptParts.push((concData as { text: string }).text);

      const fullScript = scriptParts.join('\n\n');

      // Step 2: Split script into small chunks and generate audio
      const chunks = splitText(fullScript, 2000);
      const audioChunks: string[] = [];

      for (let i = 0; i < chunks.length; i++) {
        setAudioProgress(`Synthese vocale ${i + 1}/${chunks.length}...`);
        try {
          const ttsData = await callApi('/api/tts-chunk', { text: chunks[i] });
          if ((ttsData as { audio: string }).audio) {
            audioChunks.push((ttsData as { audio: string }).audio);
          }
        } catch (ttsErr) {
          console.warn(`TTS chunk ${i + 1} failed, skipping:`, ttsErr);
        }
      }

      if (audioChunks.length === 0) throw new Error('Aucun chunk audio genere');

      // Step 3: Combine base64 chunks into a single audio blob
      const combined = audioChunks.map(b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0)));
      const totalLen = combined.reduce((sum, arr) => sum + arr.length, 0);
      const merged = new Uint8Array(totalLen);
      let offset = 0;
      for (const arr of combined) {
        merged.set(arr, offset);
        offset += arr.length;
      }
      const blob = new Blob([merged], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      setAudioProgress('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur audio');
      setAudioProgress('');
    } finally {
      setGeneratingAudio(false);
    }
  };

  const filtered = activeCategory === 'all'
    ? articles
    : articles.filter((a) => a.category === activeCategory);

  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <main className="min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#0a0a0f]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                <span className="text-red-500">&#9679;</span> Le Radar IA
              </h1>
              <p className="text-gray-500 text-sm mt-1">Veille hebdo — {today}</p>
            </div>
            <button
              onClick={fetchArticles}
              disabled={loading}
              className="px-5 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Chargement...' : 'Rafraichir la veille'}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Stats bar */}
        {stats.total > 0 && (
          <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
            <div className="text-gray-300 text-sm">
              <span className="text-white font-semibold text-lg">{stats.total}</span> articles cette semaine —{' '}
              <span className="text-red-400">{stats.red} 🔴</span>{' '}
              <span className="text-yellow-400">{stats.yellow} 🟡</span>{' '}
              <span className="text-green-400">{stats.green} 🟢</span>
            </div>
            <button
              onClick={handleGenerateAudio}
              disabled={generatingAudio || articles.length === 0}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {generatingAudio ? (
                <>
                  <span className="animate-pulse">🎙️</span> {audioProgress || 'Generation en cours...'}
                </>
              ) : (
                <>🎧 Generer le resume audio (15 min)</>
              )}
            </button>
          </div>
        )}

        {/* Audio Player */}
        {audioUrl && (
          <div className="mb-6">
            <AudioPlayer audioUrl={audioUrl} />
          </div>
        )}

        {/* Category filters */}
        {articles.length > 0 && (
          <div className="flex gap-2 mb-6 flex-wrap">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeCategory === 'all'
                  ? 'bg-white/15 text-white'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              Tout ({articles.length})
            </button>
            {CATEGORIES.map((cat) => {
              const count = articles.filter((a) => a.category === cat).length;
              if (count === 0) return null;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeCategory === cat
                      ? 'bg-white/15 text-white'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* Articles grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-gray-400 text-sm">{loadingProgress || 'Recuperation et analyse des articles...'}</p>
            <p className="text-gray-600 text-xs mt-1">Cela peut prendre 1-2 minutes</p>
          </div>
        ) : articles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="text-5xl mb-4">📡</div>
            <h2 className="text-xl font-semibold text-white mb-2">Prete pour la veille ?</h2>
            <p className="text-gray-400 text-sm max-w-md">
              Clique sur &quot;Rafraichir la veille&quot; pour recuperer et analyser les derniers articles IA de la semaine.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filtered.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 mt-16 py-6">
        <p className="text-center text-gray-600 text-xs">
          Le Radar IA — Veille IA personnalisee — Propulse par Claude &amp; ElevenLabs
        </p>
      </footer>
    </main>
  );
}
