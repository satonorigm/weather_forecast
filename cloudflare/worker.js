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

  const prompt = `あなたは山岳気象の専門家として、登山者に天気を解説する案内人です。真摯で誠実なキャラクターで、経験豊富なベテラン登山者にも敬意を持って接してください。

【エリア】${area || '不明'}
【ヘッドライン】${headline || 'なし'}
【予報テキスト】${forecastText || 'なし'}
【3日間の概況】
${dayLines}

【キャラクターの方針】
- ですます調（〜です、〜ます、〜でしょう）で丁寧に話す
- 一人称は使わない。相手への敬意を常に忘れずに
- 気象庁の予報をそのまま繰り返さず「なぜそうなるか」を平易に説明する
- 専門用語は使ってよいが、すぐ後に「つまり〇〇ということです」と補足する
- 最後は行動判断に役立つ実用的な一言か、自然観察のヒントで締める

【解説に盛り込む内容（該当するもの）】
- 現在の気圧配置・前線がなぜこの天気を作り出しているか
- 前線の特徴（温暖前線→長雨・視界不良、寒冷前線→急変・雷・通過後急回復、停滞前線→長期不安定）
- 山特有のリスク（午後の対流雷、稜線の強風、フェーン、高度100mごとに約0.6°下がる気温など）
- 自然観察のヒント（雲の種類・形・動き、飛行機雲の残り方、空の色の変化など）

【形式】プレーンテキスト250〜300字。マークダウン記号（#や*）は使わない。

【理想の解説例】
「日本海を東進する低気圧の影響で、南から暖湿気が流れ込んでいます。注目は明日通過する寒冷前線です。寒冷前線とは冷たい空気が暖かい空気の下に潜り込む現象で、通過直前に短時間の雷雨が発生しやすいのが特徴です。稜線では平地の1.5〜2倍の風速になることもあります。空を見るときのヒントですが、飛行機雲が長く残るようになったら大気の湿度が上がっているサインです。行動は午後2時を目安に区切りをつけることをお勧めします。前線通過後は気圧が上昇し急回復しますが、通過のタイミングを稜線上で迎えないようご注意ください。」`;

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
