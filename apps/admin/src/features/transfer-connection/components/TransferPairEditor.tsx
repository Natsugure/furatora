'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { notifications } from '@mantine/notifications';
import { Alert, Button, Card, Group, Stack, Switch, Text, Textarea, Title } from '@mantine/core';
import { Plus } from 'lucide-react';
import { describeError } from '@/features/station-publishing/describeError';
import type { TransferPairEditContext } from '../ports';
import {
  addRoute, detachFromSharedRoute, draftFromContext, duplicateRoute, hasDivergentLinks, removeRoute,
  toSaveInput, toggleCombo, toggleFacility, updateRoute,
} from '../domain/draft';
import {
  applyDuplicateChoices, findDuplicates, matchKey, type DuplicateChoice, type DuplicateMatch,
} from '../domain/duplicates';
import { withLine } from '../domain/label';
import { COMBO_KEYS, type ComboKey, type PairDraft } from '../domain/types';
import { collectWarnings, validateSaveInput, type ValidationIssue } from '../domain/validate';
import { DuplicateRouteModal } from './DuplicateRouteModal';
import { RouteCard } from './RouteCard';

type Props = {
  context: TransferPairEditContext;
};

export function TransferPairEditor({ context }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<PairDraft>(() => loadDraft(context));
  const [submitting, setSubmitting] = useState(false);
  // 保存を1回押すまでは検証エラーを出さない（入力途中で赤く塗らない）
  const [showErrors, setShowErrors] = useState(false);
  const [splitNotes, setSplitNotes] = useState(() => hasDifferentNotes(loadDraft(context)));
  // 保存時の重複候補（DuplicateRouteModal に出す）。「別ルートとして作る」を選んだ検出は、
  // 次の保存でもう一度聞かない（保存すると内容が既存ルートになり、検査の対象から外れる）
  const [pending, setPending] = useState<DuplicateMatch[] | null>(null);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());
  // 保存後の router.refresh() で context が新しくなったら、下書きを読み込み直す
  // （state を effect で同期せず、レンダー中に前の context と比べる。React 推奨の書き方）。
  // 【state の宣言をすべて済ませてから書くこと】setter を宣言前に呼ぶと実行時エラーになる
  const [loadedContext, setLoadedContext] = useState(context);
  if (loadedContext !== context) {
    const next = loadDraft(context);
    setLoadedContext(context);
    setDraft(next);
    setShowErrors(false);
    setSplitNotes(hasDifferentNotes(next));
    setPending(null);
    setDismissed(new Set());
  }

  const input = useMemo(() => toSaveInput(draft), [draft]);
  const errors = useMemo(() => validateSaveInput(input), [input]);
  const warnings = useMemo(() => collectWarnings(input), [input]);
  const covered = coveredCombos(draft);

  const recordById = useMemo(
    () => new Map(context.routes.map((r) => [r.routeId, r])),
    [context.routes],
  );
  const candidateById = useMemo(
    () => new Map(context.candidates.map((c) => [c.routeId, c])),
    [context.candidates],
  );

  const forCard = (issues: ValidationIssue[], index: number) => issues.filter((i) => i.routeIndex === index);
  const pairLevelWarnings = warnings.filter((w) => w.routeIndex === undefined);

  function setAllNotes(value: string) {
    setDraft((d) => ({ ...d, connectionNotes: sameNotes(value) }));
  }

  // 保存する。呼び出し時点の下書き（重複の選択を反映した直後は state がまだ古いため、引数で受ける）を
  // もう一度検証してから送る
  async function save(target: PairDraft) {
    const targetInput = toSaveInput(target);
    if (rejectIfInvalid(validateSaveInput(targetInput))) return;
    setSubmitting(true);
    let res: Response;
    try {
      res = await fetch(
        `/api/stations/${context.stationId}/connections/${context.connectedStationId}/transfer`,
        { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(targetInput) },
      );
    } catch {
      // 通信の失敗（オフライン等）。下書きは残っているので、そのまま保存し直せる
      notifications.show({
        title: '保存に失敗しました',
        message: '通信できませんでした。接続を確認して、もう一度保存してください',
        color: 'red',
      });
      return;
    } finally {
      setSubmitting(false);
    }
    if (res.ok) {
      notifications.show({ title: '保存しました', message: '乗換難易度を保存しました', color: 'green' });
      router.refresh();
      return;
    }
    const body: unknown = await res.json().catch(() => null);
    notifications.show({ title: '保存に失敗しました', message: describeError(body), color: 'red' });
  }

  function rejectIfInvalid(issues: ValidationIssue[]): boolean {
    setShowErrors(true);
    if (issues.length === 0) return false;
    notifications.show({ title: '保存できません', message: issues[0]?.message ?? '入力を確認してください', color: 'red' });
    return true;
  }

  async function handleSave() {
    if (rejectIfInvalid(errors)) return;
    // 重複候補があれば、保存の前に「共有する」か「別ルートとして作る」かを選ばせる。保存は止めない
    const matches = findDuplicates(draft, context.routes, context.candidates)
      .filter((m) => !dismissed.has(matchKey(m)));
    if (matches.length > 0) {
      setPending(matches);
      return;
    }
    await save(draft);
  }

  async function handleConfirmDuplicates(choices: Record<string, DuplicateChoice>) {
    const matches = pending ?? [];
    const next = applyDuplicateChoices(draft, matches, choices);
    setDismissed((prev) => new Set([
      ...prev,
      ...matches.filter((m) => choices[matchKey(m)] !== 'share').map(matchKey),
    ]));
    setDraft(next);
    setPending(null);
    await save(next);
  }

  // 共有先の表示。この駅対に結ばれているルートは sharedWith、「共有する」で付け替えた候補ルートは usedBy
  const sharedWithOf = (routeId: string | null): string[] => {
    if (!routeId) return [];
    const record = recordById.get(routeId);
    if (record) return record.sharedWith.map((s) => `${s.stationName} ↔ ${s.connectedStationName}`);
    const candidate = candidateById.get(routeId);
    return candidate ? [candidate.usedBy] : [];
  };

  const stationAxis = {
    stationName: withLine(context.stationName, context.lineName),
    hints: context.directionHints.station,
  };
  const connectedAxis = {
    stationName: withLine(context.connectedStationName, context.connectedLineName),
    hints: context.directionHints.connected,
  };
  const notesSingleValue = covered[0] ? draft.connectionNotes[covered[0]] : '';
  const describeCombo = (combo: ComboKey) => {
    const [s, t] = combo.split(':');
    return `${stationAxis.stationName} ${s} × ${connectedAxis.stationName} ${t}`;
  };

  return (
    <Stack gap="lg" maw="56rem">
      {draft.routes.length === 0 && (
        <Alert color="gray" title="未評価です">
          この駅対にはルートがありません（未評価。「バリアフリールートが無い」とは別の状態です）。
          ルートを追加して入力してください。
        </Alert>
      )}

      {draft.routes.map((route, index) => {
        const record = route.routeId ? recordById.get(route.routeId) : undefined;
        return (
          <RouteCard
            key={route.key}
            route={route}
            index={index}
            facilityTypes={context.facilityTypes}
            stationAxis={stationAxis}
            connectedAxis={connectedAxis}
            sharedWith={sharedWithOf(route.routeId)}
            divergentLinks={record ? hasDivergentLinks(record) : false}
            errors={showErrors ? forCard(errors, index) : []}
            warnings={forCard(warnings, index)}
            onChange={(patch) => setDraft((d) => updateRoute(d, route.key, patch))}
            onToggleCombo={(combo) => setDraft((d) => toggleCombo(d, route.key, combo))}
            onToggleFacility={(code) => setDraft((d) => toggleFacility(d, route.key, code))}
            onDuplicate={() => setDraft((d) => duplicateRoute(d, route.key, crypto.randomUUID()))}
            onDetach={() => setDraft((d) => detachFromSharedRoute(d, route.key))}
            onRemove={() => setDraft((d) => removeRoute(d, route.key))}
          />
        );
      })}

      <Group>
        <Button
          variant="default"
          leftSection={<Plus size={16} />}
          onClick={() => setDraft((d) => addRoute(d, crypto.randomUUID()))}
        >
          ルートを追加
        </Button>
      </Group>

      {pairLevelWarnings.length > 0 && (
        <Alert color="yellow" title="確認してください">
          {pairLevelWarnings.map((w, i) => (
            <Text key={`${w.code}-${i}`} size="sm">
              {w.combo ? `${describeCombo(w.combo)}: ` : ''}{w.message}
            </Text>
          ))}
        </Alert>
      )}

      {covered.length > 0 && (
        <Card withBorder padding="md">
          <Stack gap="sm">
            <Title order={5}>接続の備考</Title>
            <Text size="xs" c="dimmed">
              経路上の選好（「〇〇駅のほうが便利」）は書かないでください。接続は出発地に依存しない事実だけを持ちます。
            </Text>
            <Switch
              label="方面の組み合わせごとに備考を分ける"
              checked={splitNotes}
              onChange={(e) => {
                const on = e.currentTarget.checked;
                setSplitNotes(on);
                if (!on) setAllNotes(notesSingleValue);
              }}
            />
            {splitNotes ? (
              covered.map((combo) => (
                <Textarea
                  key={combo}
                  label={describeCombo(combo)}
                  autosize
                  minRows={2}
                  value={draft.connectionNotes[combo]}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setDraft((d) => ({ ...d, connectionNotes: { ...d.connectionNotes, [combo]: value } }));
                  }}
                />
              ))
            ) : (
              <Textarea
                label="全方面共通の備考"
                autosize
                minRows={2}
                value={notesSingleValue}
                onChange={(e) => setAllNotes(e.currentTarget.value)}
              />
            )}
          </Stack>
        </Card>
      )}

      <Group>
        <Button loading={submitting} onClick={handleSave}>保存</Button>
        {showErrors && errors.length > 0 && (
          <Text size="sm" c="red">保存できない項目があります。上の赤い表示を確認してください。</Text>
        )}
      </Group>

      {/* 開くたびに作り直し、前回の選択を持ち越さない */}
      {pending && (
        <DuplicateRouteModal
          matches={pending}
          routes={draft.routes}
          onConfirm={handleConfirmDuplicates}
          onCancel={() => setPending(null)}
        />
      )}
    </Stack>
  );
}

// 【全方面共通の欄で表示するときは、未適用の組み合わせにも同じ備考を持たせる】
// draftFromContext は接続行の無い組み合わせを '' にするため、そのままだと、あとから適用した組み合わせだけ
// 画面に見えている備考と違う値（null）で保存される。共通の欄は setAllNotes と同じく「4つとも同じ値」を保つ
function loadDraft(context: TransferPairEditContext): PairDraft {
  const draft = draftFromContext(context);
  if (hasDifferentNotes(draft)) return draft;
  const [first] = coveredCombos(draft);
  return { ...draft, connectionNotes: sameNotes(first ? draft.connectionNotes[first] : '') };
}

function sameNotes(value: string): PairDraft['connectionNotes'] {
  return Object.fromEntries(COMBO_KEYS.map((c) => [c, value])) as PairDraft['connectionNotes'];
}

// ルートが適用されている組み合わせの備考が、組み合わせごとに異なるか（異なるなら分けた欄で表示する）
function hasDifferentNotes(draft: PairDraft): boolean {
  return new Set(coveredCombos(draft).map((c) => draft.connectionNotes[c])).size > 1;
}

function coveredCombos(draft: PairDraft): ComboKey[] {
  const set = new Set(draft.routes.flatMap((r) => r.combos));
  return COMBO_KEYS.filter((c) => set.has(c));
}
