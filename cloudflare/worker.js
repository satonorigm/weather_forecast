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

  const prompt = `あなたは山岳気象の熟練した専門家です。以下の気象データをもとに、登山者向けに「気象庁が言わない視点」で解説してください。

【エリア】${area || '不明'}
【ヘッドライン】${headline || 'なし'}
【予報テキスト】${forecastText || 'なし'}
【3日間の概況】
${dayLines}

【最重要】気象庁の予報テキストをそのまま繰り返さないこと。以下の観点から気象力学的に深掘りしてください：

1. 前線の種類と特有の現象
   - 温暖前線：前方数百kmから層雲・霧が発生、長時間の雨、視界不良
   - 寒冷前線：通過時に急変・雷、通過後は急回復
   - 停滞前線：長期間の不安定、梅雨前線・秋雨前線の特徴
   - 閉塞前線：複雑な天気変化

2. 気圧配置の読み方
   - 等圧線の間隔と風速の関係
   - 低気圧の移動方向・速度と天気変化のタイミング
   - 気団の特徴（オホーツク海高気圧=冷湿、太平洋高気圧=高温多湿、シベリア高気圧=乾燥寒冷）

3. 山岳固有のリスク
   - 対流不安定による午後の雷雨発生条件
   - 稜線の風速（平地の1.5〜2倍）
   - フェーン現象、山谷風、山岳波
   - 高度による気温低下（100mで約0.6°低下）

4. 空を読むヒント
   - 登山者が自分で天気変化を察知できる具体的なサイン

プレーンテキストで250〜300字、登山経験者が「なるほど」と思える専門的な内容で。`;

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
