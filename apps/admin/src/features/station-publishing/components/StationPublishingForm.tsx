'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { notifications } from '@mantine/notifications';
import {
  Alert, Badge, Button, Card, Group, List, ListItem, Stack, Text, TextInput, Title,
} from '@mantine/core';
import type { LineMissingSlugDTO, PublishingLineDTO, PublishingStationDTO } from '../ports';

type Props = {
  stationId: string;
  station: PublishingStationDTO;
  line: PublishingLineDTO | null;
  /** null は「路線の slug が無い、またはカナが無いため候補を作れない」 */
  slugCandidate: string | null;
  hasKanaDefect: boolean;
  facilityInputCount: number;
  facilityTypeCount: number;
  linesMissingSlug: LineMissingSlugDTO[];
};

export function StationPublishingForm({
  stationId, station, line, slugCandidate, hasKanaDefect,
  facilityInputCount, facilityTypeCount, linesMissingSlug,
}: Props) {
  const router = useRouter();
  // 公開中は現在の slug を、未公開は候補を初期値にする。管理者はここで確認・編集して確定する
  // （design.md「slug の候補を提示し、管理者が確認・編集して確定する」）
  const [slug, setSlug] = useState(station.slug ?? slugCandidate ?? '');
  const [submitting, setSubmitting] = useState(false);

  const isPublished = station.publishedAt !== null;
  const canPublish = !!line?.slug;

  async function handlePublish() {
    if (!slug) {
      notifications.show({ title: '公開エラー', message: 'slug を入力してください', color: 'red' });
      return;
    }
    setSubmitting(true);
    const res = await fetch(`/api/stations/${stationId}/publication`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'publish', slug }),
    });
    setSubmitting(false);
    if (res.ok) {
      notifications.show({ title: '公開しました', message: `${station.name} を公開しました`, color: 'green' });
      router.refresh();
      return;
    }
    const body: unknown = await res.json().catch(() => null);
    notifications.show({ title: '公開に失敗しました', message: describeError(body), color: 'red' });
  }

  async function handleUnpublish() {
    setSubmitting(true);
    const res = await fetch(`/api/stations/${stationId}/publication`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'unpublish' }),
    });
    setSubmitting(false);
    if (res.ok) {
      notifications.show({ title: '非公開に戻しました', message: `${station.name} を非公開にしました`, color: 'gray' });
      router.refresh();
      return;
    }
    notifications.show({ title: '操作に失敗しました', message: '非公開への変更に失敗しました', color: 'red' });
  }

  return (
    <Stack gap="lg" maw="42rem">
      <Group gap="xs">
        <Text size="sm" fw={500}>現在の状態:</Text>
        <Badge color={isPublished ? 'green' : 'gray'}>{isPublished ? '公開中' : '非公開'}</Badge>
      </Group>

      {!canPublish && (
        <Alert color="orange" title="先に路線の slug が必要です">
          所属路線「{line?.name ?? '(路線不明)'}」に slug が設定されていないため、この駅は公開できません。
          {line && (
            <>
              {' '}
              <Link href={`/lines/${line.id}/edit`}>路線を編集する</Link>
            </>
          )}
        </Alert>
      )}

      <Card withBorder padding="md">
        <Title order={5} mb="sm">確認材料</Title>
        <List size="sm" spacing="xs">
          <ListItem>
            設備の入力: {facilityInputCount}/{facilityTypeCount} 種類
            {facilityInputCount < facilityTypeCount && (
              <Text component="span" c="orange"> （未入力の設備タイプがあります）</Text>
            )}
          </ListItem>
          <ListItem>
            英語名（nameEn）: {station.nameEn ?? (
              <Text component="span" c="orange">未設定（公開の必須条件ではありません。機械生成は行わないでください）</Text>
            )}
          </ListItem>
          {hasKanaDefect && (
            <ListItem>
              <Text c="orange">
                カナ表記の末尾に「エキ」「テイリュウジョウ」が付いていますが、漢字表記には
                「駅」「停留場」がありません。カナの入力を確認してください
                （家城・植木のように正当な駅名の可能性もあります）
              </Text>
            </ListItem>
          )}
        </List>
      </Card>

      <TextInput
        label="slug（URL識別子）"
        description="路線のslugとカナから機械生成した候補です。確認・編集してから確定してください"
        placeholder={slugCandidate ?? '路線のslugが無いため候補を生成できません'}
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        disabled={!canPublish || isPublished}
      />

      <Group gap="sm">
        {isPublished ? (
          <Button color="gray" loading={submitting} onClick={handleUnpublish}>
            非公開に戻す
          </Button>
        ) : (
          <Button loading={submitting} disabled={!canPublish} onClick={handlePublish}>
            公開する
          </Button>
        )}
      </Group>

      {linesMissingSlug.length > 0 && (
        <Alert color="yellow" title="データ健全性の警告: 公開駅を持つのに slug が無い路線">
          <List size="sm">
            {linesMissingSlug.map((l) => (
              <ListItem key={l.lineId}>
                <Link href={`/lines/${l.lineId}/edit`}>{l.lineName}</Link>
                {' '}（公開駅 {l.publishedStationCount} 件）
              </ListItem>
            ))}
          </List>
        </Alert>
      )}
    </Stack>
  );
}

function describeError(body: unknown): string {
  if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
    return body.error;
  }
  return '保存に失敗しました';
}
