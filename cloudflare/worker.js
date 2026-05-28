// weather-ai: 山岳気象AI解説 Cloudflare Worker
// - POST /api/ai-commentary → Claude API を呼び出して山岳気象解説を返す
// - それ以外 → 静的アセット（index.html, app.js, style.css など）を返す

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // AI解説 APIエンドポイント
    if (url.pathname === '/api/ai-commentary' && request.method === 'POST') {
      return handleAiCommentary(request, env);
    }

    // その他は静的ファイルを返す
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    return new Response('Not Found', { status: 404 });
  },
};

async function handleAiCommentary(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { area, forecastText, headline, days, chartImageUrl } = body;

  // 3日間の概況を自然言語に変換
  const dayLines = (days || []).map((d, i) => {
    const labels = ['今日', '明日', '明後日'];
    const parts = [labels[i]];
    if (d.icon)    parts.push(d.icon);
    if (d.maxTemp) parts.push(`最高${d.maxTemp}°`);
    if (d.minTemp) parts.push(`最低${d.minTemp}°`);
    if (d.wind)    parts.push(d.wind);
    return parts.join(' ');
  }).join('\n');

  const prompt = `あなたは山岳気象の専門家として、登山者に天気を解説する案内人です。ですます調で丁寧に話してください。

${chartImageUrl ? '添付の画像は気象庁発表の現在の地上天気図です。ユーザーは今この同じ天気図を画面で見ています。' : ''}

【エリア】${area || '不明'}
【気象庁の予報テキスト（参考）】${forecastText || 'なし'}
【ヘッドライン】${headline || 'なし'}
【3日間の概況】
${dayLines}

${chartImageUrl ? `【天気図を見ながら解説してください】
天気図上に見えるものを位置と方向を明示して（「西に低気圧」「日本南岸に温暖前線が東西に延びる」など）説明し、それが天気にどう影響するかを解説してください。

必ず盛り込む視点——「前線の走向（地図上の方向）」と「実際に降水域が広がる方向」はしばしば異なります。温暖前線は地図では東西に伸びていても、前線面は北側に緩やかに傾斜（勾配1/100〜1/200）しているため、降水域は前線の北方（前面）に向かって等圧線に沿って帯状に広がることがあります。「なぜ前線の向きと雨域の向きが違うのか」をひとことで説明してください。

寒冷前線（急傾斜・通過後急回復）・停滞前線の特徴にも触れてください。最後に自然観察のヒントを一つ添えてください。` : `【解説のポイント】
気圧配置・前線がなぜこの天気を作り出しているかを説明し、山特有のリスクと自然観察のヒントを含めてください。`}

プレーンテキスト400〜450字。冒頭に「本日は」「今日は」「こんにちは」などの挨拶は不要。気象の内容から直接始めてください。マークダウン記号（#や*）は使わない。`;

  // メッセージを構築（画像があれば含める）
  const userContent = [];
  if (chartImageUrl) {
    userContent.push({
      type: 'image',
      source: { type: 'url', url: chartImageUrl },
    });
  }
  userContent.push({ type: 'text', text: prompt });

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 900,
        messages: [{ role: 'user', content: userContent }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return json({ error: `Claude API error (${res.status}): ${err}` }, res.status);
    }

    const data = await res.json();
    const commentary = data.content?.[0]?.text ?? '（解説を生成できませんでした）';
    return json({ commentary });

  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
