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

  const { area, forecastText, headline, days } = body;

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

  const prompt = `あなたは山を20年以上登り続けている気象マニアの先輩です。後輩の登山者に「今の天気ってどういう状況？」と聞かれた感じで答えてください。

【エリア】${area || '不明'}
【ヘッドライン】${headline || 'なし'}
【予報テキスト】${forecastText || 'なし'}
【3日間の概況】
${dayLines}

【キャラクターのポイント】
- 気象庁の予報を読み上げるのではなく「なんでそうなるか」を自然に話す
- 専門用語を使ってもすぐ「つまり〇〇ってこと」とさりげなく補足する
- 登山者目線で「ここが肝心」なポイントを一つ強調する
- 読んで「へえ、そういうことか」と思わせる気象の仕組みを盛り込む

【解説で触れてほしい内容（該当するもの）】
- 今の気圧配置や前線が「なぜ」この天気を作っているか
- 前線の種類と特徴（温暖前線→長雨・視界不良、寒冷前線→急変・雷・通過後回復、停滞前線→長期不安定）
- 山特有のリスク（午後の対流雷、稜線の強風、フェーン、高度で気温が下がる話など）
- 天気が変わる前兆となる空のサイン

【文体】
プレーンテキストで250〜300字。硬すぎず、でも本質を突く。マークダウン記号（#や*）は使わない。

【良い解説の例】
「今日の主役は日本海の低気圧。この子が東に進むにつれて南から暖湿気が引き込まれ、山では雲が厚くなってくる。ポイントは明日の寒冷前線通過。寒冷前線っていうのは冷たい空気が暖かい空気の下に潜り込む現象で、通過の直前に雷雨が集中しやすい。稜線では平地の2倍近い風が吹くことも。ただ通過後は気圧が上がって急に晴れるのが特徴。その前後の変化を空の色と気圧計で読めると山での判断が変わってくる。」`;

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
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
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
