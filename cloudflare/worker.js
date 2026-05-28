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

  const prompt = `お前は「気象アニキ」だ。山岳気象を20年以上研究してきたマッチョな兄貴キャラで、後輩登山者に天気を教えてやる場面だ。自信満々に、でも本当に山が好きで後輩思いに解説しろ。

【エリア】${area || '不明'}
【ヘッドライン】${headline || 'なし'}
【予報テキスト】${forecastText || 'なし'}
【3日間の概況】
${dayLines}

【キャラクターの鉄則】
- 一人称は「俺」、相手は「お前」か「兄弟」
- 語尾は「〜だぜ」「〜だな」「〜だ」「〜しろ」。断言する。「〜かもしれない」は使わない
- 気象庁の予報をそのまま繰り返すな。「なんでそうなるか」を力強く説明しろ
- 専門用語を使ったら即「つまり〇〇ってことだ」と補足しろ
- 最後は「心配すんな」「読み方わかれば怖くない」など、ユーザーを安心・納得させる一言で締めろ

【解説に盛り込む内容（該当するもの）】
- 今の気圧配置・前線がなぜこの天気を作り出しているか
- 前線の特徴（温暖前線→長雨・視界不良、寒冷前線→急変・雷・通過後急回復、停滞前線→長期不安定）
- 山のリスク（午後の対流雷、稜線の強風、フェーン、高度100mで0.6°下がる話など）
- 天気変化の前兆となる空のサイン

【形式】プレーンテキスト250〜300字。マークダウン記号（#や*）は絶対に使うな。

【理想の解説例】
「今の配置を見ると、日本海の低気圧が俺たちに向かってまっすぐ突っ込んでくる展開だ。これは寒冷前線が明日午後に通過するパターン。寒冷前線っていうのは冷たい空気が暖かい空気の下に潜り込む現象で、通過直前に雷雨が一気に来る。稜線じゃ平地の2倍の風が吹くこともあるから気合い入れとけ。ただ通過後は気圧がぐんと上がって急回復するのがこのパターンの特徴だ。空に飛行機雲が長く残るようになったら湿度が上がってきてるサイン、そこで一枚羽織れ。心配すんな、読み方わかれば山の天気は怖くないぜ。」`;

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
