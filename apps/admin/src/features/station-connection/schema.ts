import { z } from 'zod';

// 乗換接続（接続一覧 station_connections）の新規作成フォームの入力（#88）。
// 乗換難易度は受け取らない（駅対の編集画面 features/transfer-connection で入力する）。
// 未知のキーは zod が捨てるので、古いクライアントが旧4列を送っても書き込まれない。
export const stationConnectionCreateSchema = z.object({
  connectedStationId: z.string().uuid(),
});

// 自己接続（connectedStationId === URL の stationId）の排除は route.ts で行う。
// stationId は URL パラメータでボディに無いため schema の .refine() には渡せない。
export type StationConnectionCreateInput = z.infer<typeof stationConnectionCreateSchema>;
