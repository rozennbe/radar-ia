import { Resend } from 'resend';
import { Article } from './types';

const resend = new Resend(process.env.RESEND_API_KEY);

const CATEGORY_COLORS: Record<string, string> = {
  'Santé & IA': '#10b981',
  'Transport & mobilité': '#3b82f6',
  'Marketing & CRM': '#a855f7',
  'Outils grand public': '#f97316',
  'Éducation & IA': '#ec4899',
};

const SCORE_EMOJIS: Record<string, string> = {
  red: '🔴',
  yellow: '🟡',
  green: '🟢',
};

export async function sendDigestEmail(articles: Article[], audioUrl?: string) {
  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const stats = {
    total: articles.length,
    red: articles.filter((a) => a.scoreLevel === 'red').length,
    yellow: articles.filter((a) => a.scoreLevel === 'yellow').length,
    green: articles.filter((a) => a.scoreLevel === 'green').length,
  };

  const articleCards = articles
    .filter((a) => a.scoreLevel !== 'green')
    .map((a) => {
      const catColor = CATEGORY_COLORS[a.category] || '#6b7280';
      const emoji = SCORE_EMOJIS[a.scoreLevel];
      return `
        <tr>
          <td style="padding: 16px 0; border-bottom: 1px solid #1f2937;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <span style="font-size: 14px;">${emoji}</span>
              <span style="font-size: 12px; color: #9ca3af; font-family: monospace;">${a.score}/10</span>
              <span style="font-size: 11px; padding: 2px 8px; border-radius: 12px; background: ${catColor}22; color: ${catColor}; border: 1px solid ${catColor}44;">${a.category}</span>
            </div>
            <a href="${a.url}" style="color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; line-height: 1.4;">
              ${a.title}
            </a>
            <p style="color: #9ca3af; font-size: 13px; margin: 8px 0 4px; line-height: 1.5;">
              ${a.summary}
            </p>
            <span style="color: #6b7280; font-size: 11px;">${a.source}</span>
          </td>
        </tr>`;
    })
    .join('');

  const audioSection = audioUrl
    ? `<div style="background: linear-gradient(135deg, #1e3a5f, #2d1b69); border-radius: 12px; padding: 20px; margin-bottom: 24px; text-align: center;">
        <a href="${process.env.NEXT_PUBLIC_BASE_URL}${audioUrl}" style="color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600;">
          ▶️ Ecouter le resume audio (~15 min)
        </a>
      </div>`
    : '';

  const html = `
    <div style="max-width: 600px; margin: 0 auto; background: #0a0a0f; color: #ededed; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 32px 24px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #ffffff; font-size: 24px; margin: 0;">
          <span style="color: #ef4444;">●</span> Le Radar IA
        </h1>
        <p style="color: #6b7280; font-size: 13px; margin-top: 8px;">Veille hebdo — ${today}</p>
      </div>

      <div style="text-align: center; margin-bottom: 24px; padding: 12px; background: #111118; border-radius: 8px;">
        <span style="color: #ffffff; font-weight: 600; font-size: 18px;">${stats.total}</span>
        <span style="color: #9ca3af; font-size: 13px;"> articles —
          <span style="color: #f87171;">${stats.red} 🔴</span>
          <span style="color: #facc15;">${stats.yellow} 🟡</span>
          <span style="color: #4ade80;">${stats.green} 🟢</span>
        </span>
      </div>

      ${audioSection}

      <table style="width: 100%; border-collapse: collapse;">
        <tbody>
          ${articleCards}
        </tbody>
      </table>

      <div style="text-align: center; margin-top: 32px; padding-top: 16px; border-top: 1px solid #1f2937;">
        <p style="color: #4b5563; font-size: 11px;">Le Radar IA — Propulse par Claude & ElevenLabs</p>
      </div>
    </div>
  `;

  const { data, error } = await resend.emails.send({
    from: 'Le Radar IA <onboarding@resend.dev>',
    to: ['rozennbe@gmail.com'],
    subject: `🔴 Ton Radar IA — ${today} — ${stats.total} actus`,
    html,
  });

  if (error) {
    throw new Error(`Erreur Resend: ${JSON.stringify(error)}`);
  }

  return data;
}
