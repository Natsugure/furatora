import { z } from 'zod';

// 乗換接続（接続一覧 station_connections）の新規作成フォームの入力（#88）。
// 乗換難易度はここでは受け取らない。駅対の編集画面（features/transfer-connection。#124）で、
// 新モデル（transfer_connections 以下）に入力する。旧4列（strollerDifficulty 等）の入力を
// 受け付けるのをやめた経緯は docs/domain/station-master-model.md「乗換難易度」を参照。
// 未知のキーは zod が捨てるので、古いクライアントが旧4列を送っても書き込まれない。
export const stationConnectionCreateSchema = z.object({
  connectedStationId: z.string().uuid(),
});

// 自己接続（connectedStationId === URL の stationId）の排除は route.ts で行う。
// stationId は URL パラメータでボディに無いため schema の .refine() には渡せない。
export type StationConnectionCreateInput = z.infer<typeof stationConnectionCreateSchema>;
