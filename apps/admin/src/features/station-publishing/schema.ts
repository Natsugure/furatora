import { z } from 'zod';

// slug は stations.slug と同じ制約（varchar(100)）。URL識別子であり
// 公式表記の正しさは問わない（design.md「nameEn と分離する」）。
// 英小文字・数字の区間をハイフン1個で繋ぐ形のみ許可する。
// 先頭・末尾のハイフン、連続ハイフン、ハイフンのみの文字列は
// 不正な公開 URL になるため弾く（buildSlugCandidate の出力はこの形を満たす）。
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const publishStationSchema = z.object({
  action: z.literal('publish'),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(slugPattern, 'slug は英小文字・数字をハイフンで繋いだ形式のみ使用できる（先頭・末尾・連続のハイフンは不可）'),
});

export const unpublishStationSchema = z.object({
  action: z.literal('unpublish'),
});

export const stationPublicationSchema = z.discriminatedUnion('action', [
  publishStationSchema,
  unpublishStationSchema,
]);

export type StationPublicationInput = z.infer<typeof stationPublicationSchema>;
