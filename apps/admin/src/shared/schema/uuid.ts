// 外から受け取る UUID（パス・searchParams・リクエストボディ）を検証し、小文字にそろえる（#160）。
// DB は uuid を小文字で返すため、大文字のまま下に流すと JS 側の比較・Map・Set・文字列の並び順が
// DB の値と食い違う（例: 自己接続の判定のすり抜け、隣接の端点の昇順正規化の崩れ）。
// feature 横断の shared/ に置く（ADR-0001）ため、Drizzle も Next.js も import しない。

import { z } from 'zod';

export const uuidSchema = z.uuid().transform((v) => v.toLowerCase());
