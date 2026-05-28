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

${chartImageUrl ? `【天気図を見ながら、以下の順で解説してください】

1. 天気図に何が見えるか（位置を具体的に）
   例：「天気図の日本海中央に低気圧（L）があり、そこから南東に寒冷前線が延びています」

2. 前線・低気圧のどちら側が今どんな状態か（これが最重要）
   ■ 温暖前線がある場合
     - 前線の前方（東側・寒気側）＝数百km先から層雲・霧・しとしと雨が続く危険ゾーン
     - 前線の後方（西側・暖気側）＝雨なし、暖かく蒸し暑い
   ■ 寒冷前線がある場合
     - 前線のライン直前（東側数十km）＝最危険ゾーン、雷雨・突風が集中
     - 前線の後方（西側）＝通過後は急速に回復
   ■ 低気圧がある場合
     - 南東象限（暖域）＝最も雲が多く不安定
     - 北西象限（通過後）＝気圧上昇・晴れへ向かう
   ■ 停滞前線がある場合
     - 前線付近の南側＝暖湿気が入りやすく大雨になりやすい

3. 対象エリア（${area || '不明'}）は今どのゾーンにあたるか、何に注意すべきか

4. 空・雲で天気変化を読む自然観察のヒントを一つ` : `【解説のポイント】
気圧配置・前線がなぜこの天気を作り出しているか、前線のどちら側が危険かを説明し、山特有のリスクと自然観察のヒントを含めてください。`}

プレーンテキスト350〜400字。マークダウン記号（#や*）は使わない。`;

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
        max_tokens: 600,
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
