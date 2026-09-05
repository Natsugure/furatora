import { z } from 'zod';

// slug は stations.slug と同じ制約（varchar(100)）。URL識別子であり
// 公式表記の正しさは問わない（design.md「nameEn と分離する」）
const slugPattern = /^[a-z0-9-]+$/;

export const publishStationSchema = z.object({
  action: z.literal('publish'),
  slug: z.string().min(1).max(100).regex(slugPattern, 'slug は英小文字・数字・ハイフンのみ使用できる'),
});

export const unpublishStationSchema = z.object({
  action: z.literal('unpublish'),
});

export const stationPublicationSchema = z.discriminatedUnion('action', [
  publishStationSchema,
  unpublishStationSchema,
]);

export type StationPublicationInput = z.infer<typeof stationPublicationSchema>;
