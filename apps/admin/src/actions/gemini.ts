'use server';

type GeminiContent = {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
    };
  }>;
};

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY が設定されていません');
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    }
  );

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`Gemini API エラー: ${res.status}${errorText ? ` - ${errorText}` : ''}`);
  }

  const data: GeminiContent = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('AI応答の解析に失敗しました');
  }
  return text;
}

export type RailwaySuggestion = {
  jaName: string;
  nameEn: string;
  lineCode: string;
};

export type StationSuggestion = {
  jaName: string;
  nameEn: string;
  stationCode: string;
};

/**
 * ODPT路線IDの配列から、日本語名・英語名・路線コードの提案を一括取得する。
 * 戻り値は入力と同じ順序の配列。
 */
export async function suggestRailwaysFromOdptIds(
  odptRailwayIds: string[]
): Promise<RailwaySuggestion[]> {
  if (odptRailwayIds.length === 0) return [];

  const prompt = `あなたは日本の鉄道に精通したアシスタントです。
以下のODPT路線IDリストについて、各IDに対応する路線情報を推測してください。
IDの形式は "odpt.Railway:事業者名.路線名" です。
例: odpt.Railway:JR-East.ChuoRapid → 中央線快速 / Chuo Rapid Line / JC

IDリスト:
${JSON.stringify(odptRailwayIds)}

各IDに対して以下の形式のJSONオブジェクトを含む配列を、入力と同じ順序で返してください。
不明な場合は空文字にしてください。路線コードは2〜3文字のアルファベットが一般的です。
[{"jaName":"日本語路線名","nameEn":"English line name","lineCode":"路線コード"},...]`;

  const text = await callGemini(prompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('AI応答の解析に失敗しました');
  }

  if (!Array.isArray(parsed) || parsed.length !== odptRailwayIds.length) {
    throw new Error('AI応答の解析に失敗しました');
  }

  return (parsed as RailwaySuggestion[]).map((item) => ({
    jaName: String(item?.jaName ?? ''),
    nameEn: String(item?.nameEn ?? ''),
    lineCode: String(item?.lineCode ?? ''),
  }));
}

/**
 * ODPT駅IDの配列から、日本語名・英語名・駅コードの提案を一括取得する。
 * 戻り値は入力と同じ順序の配列。
 */
export async function suggestStationsFromOdptIds(
  odptStationIds: string[]
): Promise<StationSuggestion[]> {
  if (odptStationIds.length === 0) return [];

  const prompt = `あなたは日本の鉄道に精通したアシスタントです。
以下のODPT駅IDリストについて、各IDに対応する駅情報を推測してください。
IDの形式は "odpt.Station:事業者名.路線名.駅名" です。
例: odpt.Station:JR-East.ChuoRapid.Shinjuku → 新宿 / Shinjuku / JC05

IDリスト:
${JSON.stringify(odptStationIds)}

各IDに対して以下の形式のJSONオブジェクトを含む配列を、入力と同じ順序で返してください。
不明な場合は空文字にしてください。駅コードは路線コード＋2桁数字が一般的です。
[{"jaName":"日本語駅名","nameEn":"English station name","stationCode":"駅コード"},...]`;

  const text = await callGemini(prompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('AI応答の解析に失敗しました');
  }

  if (!Array.isArray(parsed) || parsed.length !== odptStationIds.length) {
    throw new Error('AI応答の解析に失敗しました');
  }

  return (parsed as StationSuggestion[]).map((item) => ({
    jaName: String(item?.jaName ?? ''),
    nameEn: String(item?.nameEn ?? ''),
    stationCode: String(item?.stationCode ?? ''),
  }));
}
