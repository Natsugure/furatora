'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge, Button, Card, ColorSwatch, Group, Modal, Stack, Text,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  computeBounds, layoutConcoursePlates, layoutFacingBanners, exitsLabel, connectionLabels,
  isDrawable, hasDisplayableInfo,
} from '@furatora/platform-diagram/domain';
import { PlatformDiagram } from '@furatora/platform-diagram/components';
import { describeError } from '@/features/station-publishing/describeError';
import { LinkButton } from '@/components/LinkElements';
import type { LineWithDirections } from '@/features/platform/ports';
import type { FacilityTypeOption, ConnectedStationOption } from '@/features/facility/ports';
import type { TrainOptionDTO } from '@/features/stop-pattern/domain/types';
import type { CarSegment } from '@/features/stop-pattern/domain/carSegments';
import type {
  LayoutPlatformDetailDTO, LayoutConcourseDTO, LayoutStopPatternDTO,
} from '@/features/station-layout/ports';
import {
  createConcourseDraft, createEmptyConcourseDraft, duplicateConcourseDraft,
  createPatternDraft, createPatternDraftFromPreview,
  moveCell, moveCarBoundary, moveCarEdge,
  isConcourseDirty, isPatternDirty, dirtyIds, toPlatformLocationPayload, toStopPatternPayload,
  draftToDisplayConcourse, concourseDraftValidationError,
  MIN_CAR_METERS, type ConcourseDraft, type PatternDraft, type ConcourseDisplayLookups,
} from '@/features/station-layout/domain/editDraft';
import { DiagramEditLayer } from './DiagramEditLayer';
import { ConcourseInspector } from './inspector/ConcourseInspector';
import { PlatformInspector } from './inspector/PlatformInspector';
import { StopPatternCreateForm, StopPatternInspector } from './inspector/StopPatternInspector';

type Props = {
  stationId: string;
  platforms: { id: string; platformNumber: string }[];
  platform: LayoutPlatformDetailDTO;
  lines: LineWithDirections[];
  facilityTypes: FacilityTypeOption[];
  connectedStations: ConnectedStationOption[];
  trains: TrainOptionDTO[];
};

/** 複製時に座標をずらす量（m）。0だと元と完全に重なって見分けがつかない */
const DUPLICATE_OFFSET_METERS = 2;

function layoutHref(stationId: string, platformId: string, patternId?: string) {
  const params = new URLSearchParams({ platformId });
  if (patternId) params.set('patternId', patternId);
  return `/stations/${stationId}/layout?${params.toString()}`;
}

function mergePattern(baseline: LayoutStopPatternDTO, draft: PatternDraft | undefined): LayoutStopPatternDTO {
  if (!draft) return baseline;
  const byNumber = new Map(draft.cars.map((c) => [c.carNumber, c]));
  return {
    ...baseline,
    cars: baseline.cars.map((car) => {
      const d = byNumber.get(car.carNumber);
      return d ? { ...car, startMeters: d.startMeters, endMeters: d.endMeters } : car;
    }),
  };
}

/**
 * 駅レイアウトページの編集ビュー本体（Client Component）。図・編集レイヤ・
 * インスペクタ・未保存パネルを1つのツリーにまとめる（ADR-0010 決定2）。DTOはpropsで
 * 受け取り、関数propsは渡さない。
 *
 * bounds凍結（design.md「編集レイヤの座標変換」）: computeBounds は
 * concourseBaselines/patternBaselines（保存が確定した値。ドラッグ中のdraftは
 * 含まない）からのみ算出する。新規作成中のコンコース・停車パターン（newConcourse/
 * newPattern）も未保存のうちはboundsに含めない（同じ理由）。
 *
 * ConcourseDraft/PatternDraft の編集はドラッグと数値入力のどちらから来ても
 * editDraft.ts の同じ純関数を通るため、どちらの経路でも同じ不変条件が守られる。
 */
export function StationLayoutEditor({
  stationId, platforms, platform, lines, facilityTypes, connectedStations, trains,
}: Props) {
  const router = useRouter();

  const [concourseBaselines, setConcourseBaselines] = useState(platform.concourses);
  const [patternBaselines, setPatternBaselines] = useState(platform.stopPatterns);
  const [concourseDrafts, setConcourseDrafts] = useState<Map<string, ConcourseDraft>>(new Map());
  const [patternDrafts, setPatternDrafts] = useState<Map<string, PatternDraft>>(new Map());
  const [newConcourse, setNewConcourse] = useState<{ tempId: string; draft: ConcourseDraft } | null>(null);
  const [newPattern, setNewPattern] = useState<{ trainId: string; draft: PatternDraft } | null>(null);
  const [savingConcourseIds, setSavingConcourseIds] = useState<Set<string>>(new Set());
  const [savingPatternIds, setSavingPatternIds] = useState<Set<string>>(new Set());
  const [deletingConcourseIds, setDeletingConcourseIds] = useState<Set<string>>(new Set());
  const [deletingPatternIds, setDeletingPatternIds] = useState<Set<string>>(new Set());
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);
  const [selectedConcourseId, setSelectedConcourseId] = useState<string | null>(null);

  const [creatingPlatform, setCreatingPlatform] = useState(false);
  const [editingPlatform, setEditingPlatform] = useState(false);
  const [deletingPlatform, setDeletingPlatform] = useState(false);
  const [creatingPattern, setCreatingPattern] = useState(false);

  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [confirmOpened, { open: openConfirm, close: closeConfirm }] = useDisclosure(false);
  const [pendingDelete, setPendingDelete] = useState<{ label: string; onConfirm: () => void } | null>(null);
  const [deleteConfirmOpened, { open: openDeleteConfirm, close: closeDeleteConfirm }] = useDisclosure(false);

  const selectedPatternBaseline = patternBaselines.find((p) => p.patternId === platform.selectedPatternId) ?? null;
  const newPatternTrain = newPattern ? trains.find((t) => t.id === newPattern.trainId) : undefined;

  // 選択肢データのlookup。draftは表示用フィールド（typeName・接続先駅名等）を
  // 持たないため、新規・複製コンコースを図に描くにはこの解決が要る
  const lookups: ConcourseDisplayLookups = useMemo(() => {
    const facilityTypeNameByCode = new Map(facilityTypes.map((t) => [t.code, t.name]));
    const connectedStationById = new Map(connectedStations.map((s) => [s.id, s]));
    return {
      facilityTypeName: (code) => facilityTypeNameByCode.get(code) ?? code,
      connectedStation: (id) => connectedStationById.get(id),
    };
  }, [facilityTypes, connectedStations]);

  const dirtyConcourseIds = useMemo(
    () => dirtyIds(concourseBaselines, (c) => c.id, concourseDrafts, isConcourseDirty),
    [concourseBaselines, concourseDrafts],
  );
  const dirtyPatternIds = useMemo(
    () => dirtyIds(patternBaselines, (p) => p.patternId, patternDrafts, isPatternDirty),
    [patternBaselines, patternDrafts],
  );
  const isAnyDirty = dirtyConcourseIds.length > 0 || dirtyPatternIds.length > 0
    || newConcourse !== null || newPattern !== null;

  // 未保存のままタブ遷移・ページ離脱するとaddEventListenerでも止めきれない経路が残る
  // （AdminShellのナビ等。App Routerに公式のルート遷移ブロックが無いため）。
  // ここで止められるのはリロード・タブ閉じ・このコンポーネントが持つタブのみ
  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (!isAnyDirty) return;
      e.preventDefault();
    }
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isAnyDirty]);

  // 凍結bounds: concourseBaselines/patternBaselinesが変わったとき（マウント時・
  // 保存成功時）だけ再計算される。ドラッグ・新規作成中のdraftはここに含めない
  const bounds = useMemo(
    () => computeBounds(platform.physicalLength, patternBaselines, concourseBaselines),
    [platform.physicalLength, patternBaselines, concourseBaselines],
  );

  // 表示用（draft込み）のコンコース。束ね線・プレートがドラッグ・テキスト編集に
  // 追従するよう毎レンダー再計算する（bounds自体は凍結済みなのでスケールし直さない）
  const existingDisplayConcourses = useMemo(
    () => concourseBaselines.map((c) => {
      const draft = concourseDrafts.get(c.id);
      return draft ? draftToDisplayConcourse(c.id, draft, lookups) : c;
    }),
    [concourseBaselines, concourseDrafts, lookups],
  );
  const newDisplayConcourse = useMemo(
    () => (newConcourse ? draftToDisplayConcourse(newConcourse.tempId, newConcourse.draft, lookups) : null),
    [newConcourse, lookups],
  );
  const displayConcourses = useMemo(
    () => (newDisplayConcourse ? [...existingDisplayConcourses, newDisplayConcourse] : existingDisplayConcourses),
    [existingDisplayConcourses, newDisplayConcourse],
  );

  const displayPattern: LayoutStopPatternDTO | null = useMemo(() => {
    if (newPattern && newPatternTrain) {
      const doorCountByCar = new Map(newPatternTrain.cars.map((c) => [c.carNumber, c.doorCount]));
      return {
        patternId: '__new__',
        trainId: newPattern.trainId,
        trainLabel: newPatternTrain.name,
        carCount: newPatternTrain.carCount,
        cars: newPattern.draft.cars.map((c) => ({
          ...c,
          doorCount: doorCountByCar.get(c.carNumber) ?? 4,
          freeSpaceDoors: [],
          prioritySeatDoors: [],
        })),
      };
    }
    if (!selectedPatternBaseline) return null;
    return mergePattern(selectedPatternBaseline, patternDrafts.get(selectedPatternBaseline.patternId));
  }, [newPattern, newPatternTrain, selectedPatternBaseline, patternDrafts]);

  const plateLayout = useMemo(() => layoutConcoursePlates(displayConcourses, bounds), [displayConcourses, bounds]);
  const facingLayout = useMemo(() => layoutFacingBanners(displayConcourses, bounds), [displayConcourses, bounds]);

  // draftがあればdraft.cellsを見る（インスペクタで追加したセルはbaselineにまだ無いため）
  const cellToConcourseId = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of concourseBaselines) {
      const cells = concourseDrafts.get(c.id)?.cells ?? c.cells;
      for (const cell of cells) map.set(cell.id, c.id);
    }
    if (newConcourse) for (const cell of newConcourse.draft.cells) map.set(cell.id, newConcourse.tempId);
    return map;
  }, [concourseBaselines, concourseDrafts, newConcourse]);

  /** 既存コンコースのdraftを更新する。newConcourse.tempId が来た場合はそちらを更新する */
  function updateConcourseDraft(concourseId: string, mutate: (draft: ConcourseDraft) => ConcourseDraft) {
    if (newConcourse?.tempId === concourseId) {
      setNewConcourse((prev) => (prev ? { ...prev, draft: mutate(prev.draft) } : prev));
      return;
    }
    setConcourseDrafts((prev) => {
      const baseline = concourseBaselines.find((c) => c.id === concourseId);
      if (!baseline) return prev;
      const next = new Map(prev);
      const current = next.get(concourseId) ?? createConcourseDraft(baseline);
      next.set(concourseId, mutate(current));
      return next;
    });
  }

  const selectedConcourseDraft = useMemo(() => {
    if (!selectedConcourseId) return null;
    if (newConcourse?.tempId === selectedConcourseId) return newConcourse.draft;
    const baseline = concourseBaselines.find((c) => c.id === selectedConcourseId);
    if (!baseline) return null;
    return concourseDrafts.get(selectedConcourseId) ?? createConcourseDraft(baseline);
  }, [selectedConcourseId, newConcourse, concourseBaselines, concourseDrafts]);

  function selectCell(cellId: string) {
    setSelectedCellId(cellId);
    const concourseId = cellToConcourseId.get(cellId);
    if (concourseId) setSelectedConcourseId(concourseId);
  }

  function handleMoveCell(cellId: string, x: number) {
    const concourseId = cellToConcourseId.get(cellId);
    if (!concourseId) return;
    updateConcourseDraft(concourseId, (draft) => moveCell(draft, cellId, x));
  }

  function handleMoveCarBoundary(boundaryIndex: number, x: number) {
    if (newPattern) {
      setNewPattern((prev) => (prev
        ? { ...prev, draft: moveCarBoundary(prev.draft, boundaryIndex, x, { minCarMeters: MIN_CAR_METERS }) }
        : prev));
      return;
    }
    if (!selectedPatternBaseline) return;
    updatePatternDraft(
      selectedPatternBaseline.patternId,
      (draft) => moveCarBoundary(draft, boundaryIndex, x, { minCarMeters: MIN_CAR_METERS }),
    );
  }

  function handleMoveCarEdge(edge: { carNumber: number; side: 'start' | 'end' }, x: number) {
    if (newPattern) {
      setNewPattern((prev) => (prev
        ? { ...prev, draft: moveCarEdge(prev.draft, edge, x, { minCarMeters: MIN_CAR_METERS }) }
        : prev));
      return;
    }
    if (!selectedPatternBaseline) return;
    updatePatternDraft(
      selectedPatternBaseline.patternId,
      (draft) => moveCarEdge(draft, edge, x, { minCarMeters: MIN_CAR_METERS }),
    );
  }

  function updatePatternDraft(patternId: string, mutate: (draft: PatternDraft) => PatternDraft) {
    setPatternDrafts((prev) => {
      const baseline = patternBaselines.find((p) => p.patternId === patternId);
      if (!baseline) return prev;
      const next = new Map(prev);
      const current = next.get(patternId) ?? createPatternDraft(baseline);
      next.set(patternId, mutate(current));
      return next;
    });
  }

  /**
   * 1アグリゲート分のPUT/POSTを実行する共通処理。concourse/pattern・新規/既存は
   * 「対象を特定する・payloadを組み立てる・保存成功後にbaselineへ反映する」点だけが
   * 異なり、fetch・エラー通知・saving中フラグの管理は共通のためここに集約する。
   */
  async function saveAggregate(opts: {
    id: string;
    method: 'POST' | 'PUT';
    url: string;
    payload: unknown;
    setSavingIds: (mutate: (prev: Set<string>) => Set<string>) => void;
    onSaved: (responseBody: unknown) => void;
    successMessage: string;
  }) {
    const {
      id, method, url, payload, setSavingIds, onSaved, successMessage,
    } = opts;
    setSavingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        notifications.show({ title: '保存に失敗しました', message: describeError(body), color: 'red' });
        return;
      }
      onSaved(body);
      notifications.show({ title: '保存しました', message: successMessage, color: 'green' });
      router.refresh();
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function saveConcourse(concourse: LayoutConcourseDTO) {
    const draft = concourseDrafts.get(concourse.id);
    if (!draft) return;
    const validationError = concourseDraftValidationError(draft);
    if (validationError) {
      notifications.show({ title: '保存できません', message: validationError, color: 'red' });
      return;
    }
    const label = exitsLabel(concourse) ?? connectionLabels(concourse)[0] ?? 'コンコース';
    await saveAggregate({
      id: concourse.id,
      method: 'PUT',
      url: `/api/stations/${stationId}/platform-locations/${concourse.id}`,
      payload: toPlatformLocationPayload(platform.id, draft),
      setSavingIds: setSavingConcourseIds,
      onSaved: () => {
        setConcourseBaselines((prev) => prev.map((c) => (
          c.id === concourse.id ? draftToDisplayConcourse(concourse.id, draft, lookups) : c
        )));
        setConcourseDrafts((prev) => {
          const next = new Map(prev);
          next.delete(concourse.id);
          return next;
        });
      },
      successMessage: `${label} の位置を保存しました`,
    });
  }

  async function saveNewConcourse() {
    if (!newConcourse) return;
    const { tempId, draft } = newConcourse;
    const validationError = concourseDraftValidationError(draft);
    if (validationError) {
      notifications.show({ title: '保存できません', message: validationError, color: 'red' });
      return;
    }
    await saveAggregate({
      id: tempId,
      method: 'POST',
      url: `/api/stations/${stationId}/platform-locations`,
      payload: toPlatformLocationPayload(platform.id, draft),
      setSavingIds: setSavingConcourseIds,
      onSaved: (body) => {
        const createdId = (body as { id?: string } | null)?.id;
        if (!createdId) return;
        setConcourseBaselines((prev) => [...prev, draftToDisplayConcourse(createdId, draft, lookups)]);
        setNewConcourse(null);
        setSelectedConcourseId((prevId) => (prevId === tempId ? createdId : prevId));
      },
      successMessage: '新しいコンコースを保存しました',
    });
  }

  async function savePattern(pattern: LayoutStopPatternDTO) {
    const draft = patternDrafts.get(pattern.patternId);
    if (!draft) return;
    await saveAggregate({
      id: pattern.patternId,
      method: 'PUT',
      url: `/api/stations/${stationId}/train-stop-patterns/${pattern.patternId}`,
      payload: toStopPatternPayload(platform.id, pattern.trainId, draft),
      setSavingIds: setSavingPatternIds,
      onSaved: () => {
        setPatternBaselines((prev) => prev.map((p) => (p.patternId === pattern.patternId ? mergePattern(p, draft) : p)));
        setPatternDrafts((prev) => {
          const next = new Map(prev);
          next.delete(pattern.patternId);
          return next;
        });
      },
      successMessage: `${pattern.trainLabel} の停車位置を保存しました`,
    });
  }

  async function saveNewPattern() {
    if (!newPattern || !newPatternTrain) return;
    const { trainId, draft } = newPattern;
    const train = newPatternTrain;
    await saveAggregate({
      id: '__new_pattern__',
      method: 'POST',
      url: `/api/stations/${stationId}/train-stop-patterns`,
      payload: toStopPatternPayload(platform.id, trainId, draft),
      setSavingIds: setSavingPatternIds,
      onSaved: (body) => {
        const created = body as { id?: string } | null;
        if (!created?.id) return;
        const doorCountByCar = new Map(train.cars.map((c) => [c.carNumber, c.doorCount]));
        const newBaseline: LayoutStopPatternDTO = {
          patternId: created.id,
          trainId,
          trainLabel: train.name,
          carCount: train.carCount,
          cars: draft.cars.map((c) => ({
            ...c, doorCount: doorCountByCar.get(c.carNumber) ?? 4, freeSpaceDoors: [], prioritySeatDoors: [],
          })),
        };
        setPatternBaselines((prev) => [...prev, newBaseline]);
        setNewPattern(null);
      },
      successMessage: `${train.name} の停車位置を保存しました`,
    });
  }

  function requestDelete(label: string, onConfirm: () => void) {
    setPendingDelete({ label, onConfirm });
    openDeleteConfirm();
  }

  function confirmDelete() {
    const pending = pendingDelete;
    closeDeleteConfirm();
    setPendingDelete(null);
    pending?.onConfirm();
  }

  async function deleteConcourse(concourseId: string, label: string) {
    setDeletingConcourseIds((prev) => new Set(prev).add(concourseId));
    try {
      const res = await fetch(`/api/stations/${stationId}/platform-locations/${concourseId}`, { method: 'DELETE' });
      if (!res.ok) {
        const body: unknown = await res.json().catch(() => null);
        notifications.show({ title: '削除に失敗しました', message: describeError(body), color: 'red' });
        return;
      }
      setConcourseBaselines((prev) => prev.filter((c) => c.id !== concourseId));
      setConcourseDrafts((prev) => {
        const next = new Map(prev);
        next.delete(concourseId);
        return next;
      });
      if (selectedConcourseId === concourseId) setSelectedConcourseId(null);
      notifications.show({ title: '削除しました', message: `${label} を削除しました`, color: 'green' });
      router.refresh();
    } finally {
      setDeletingConcourseIds((prev) => {
        const next = new Set(prev);
        next.delete(concourseId);
        return next;
      });
    }
  }

  async function deletePattern(patternId: string, label: string) {
    setDeletingPatternIds((prev) => new Set(prev).add(patternId));
    try {
      const res = await fetch(`/api/stations/${stationId}/train-stop-patterns/${patternId}`, { method: 'DELETE' });
      if (!res.ok) {
        const body: unknown = await res.json().catch(() => null);
        notifications.show({ title: '削除に失敗しました', message: describeError(body), color: 'red' });
        return;
      }
      setPatternBaselines((prev) => prev.filter((p) => p.patternId !== patternId));
      setPatternDrafts((prev) => {
        const next = new Map(prev);
        next.delete(patternId);
        return next;
      });
      notifications.show({ title: '削除しました', message: `${label} の停車位置を削除しました`, color: 'green' });
      router.refresh();
    } finally {
      setDeletingPatternIds((prev) => {
        const next = new Set(prev);
        next.delete(patternId);
        return next;
      });
    }
  }

  async function deletePlatform() {
    setDeletingPlatform(true);
    try {
      const res = await fetch(`/api/stations/${stationId}/platforms/${platform.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body: unknown = await res.json().catch(() => null);
        notifications.show({ title: '削除に失敗しました', message: describeError(body), color: 'red' });
        return;
      }
      notifications.show({ title: '削除しました', message: `${platform.platformNumber}番ホームを削除しました`, color: 'green' });
      router.push(`/stations/${stationId}/layout`);
      router.refresh();
    } finally {
      setDeletingPlatform(false);
    }
  }

  function startNewConcourse() {
    const tempId = crypto.randomUUID();
    setNewConcourse({ tempId, draft: createEmptyConcourseDraft() });
    setSelectedConcourseId(tempId);
  }

  function duplicateConcourse(concourse: LayoutConcourseDTO) {
    const tempId = crypto.randomUUID();
    const draft = duplicateConcourseDraft(concourse, DUPLICATE_OFFSET_METERS, () => crypto.randomUUID());
    setNewConcourse({ tempId, draft });
    setSelectedConcourseId(tempId);
  }

  function discardNewConcourse() {
    if (!newConcourse) return;
    if (selectedConcourseId === newConcourse.tempId) setSelectedConcourseId(null);
    setNewConcourse(null);
  }

  function handlePreviewNewPattern(trainId: string, segments: CarSegment[]) {
    setNewPattern({ trainId, draft: createPatternDraftFromPreview(segments) });
    setCreatingPattern(false);
  }

  function fillPositionsForConcourse(concourse: LayoutConcourseDTO) {
    const center = (bounds.minX + bounds.maxX) / 2;
    const nullCellIds = concourse.cells.filter((c) => c.xPositionMeters === null).map((c) => c.id);
    updateConcourseDraft(concourse.id, (draft) => (
      nullCellIds.reduce((d, cellId) => moveCell(d, cellId, center), draft)
    ));
    setSelectedConcourseId(concourse.id);
    setSelectedCellId(nullCellIds[0] ?? null);
  }

  function handleTabClick(e: React.MouseEvent, href: string) {
    if (!isAnyDirty) return; // 未保存が無ければ通常のLinkナビゲーションに任せる
    e.preventDefault();
    setPendingHref(href);
    openConfirm();
  }

  function confirmDiscardAndNavigate() {
    closeConfirm();
    if (pendingHref) router.push(pendingHref);
    setPendingHref(null);
  }

  /** 表示中の停車パターン（新規プレビュー／既存選択中）に応じた保存・削除・取り消しの導線を組み立てる */
  function patternActions(): { onSave: () => void; onDelete?: () => void; onDiscard?: () => void } {
    if (newPattern) {
      return { onSave: saveNewPattern, onDiscard: () => setNewPattern(null) };
    }
    return {
      onSave: () => { if (selectedPatternBaseline) void savePattern(selectedPatternBaseline); },
      onDelete: selectedPatternBaseline
        ? () => requestDelete(
          `${selectedPatternBaseline.trainLabel} の停車位置`,
          () => deletePattern(selectedPatternBaseline.patternId, selectedPatternBaseline.trainLabel),
        )
        : undefined,
    };
  }

  /** 選択中のコンコース（新規作成中を含む）に応じた保存・削除・取り消しの導線を組み立てる */
  function concourseActions(concourseId: string): { onSave: () => void; onDelete?: () => void; onDiscard?: () => void } {
    if (newConcourse?.tempId === concourseId) {
      return { onSave: saveNewConcourse, onDiscard: discardNewConcourse };
    }
    return {
      onSave: () => {
        const baseline = concourseBaselines.find((c) => c.id === concourseId);
        if (baseline) void saveConcourse(baseline);
      },
      onDelete: () => {
        const baseline = concourseBaselines.find((c) => c.id === concourseId);
        if (!baseline) return;
        const label = exitsLabel(baseline) ?? connectionLabels(baseline)[0] ?? 'コンコース';
        requestDelete(label, () => deleteConcourse(baseline.id, label));
      },
    };
  }

  const undrawableConcourses = useMemo(
    () => existingDisplayConcourses.filter((c) => !isDrawable(c) && hasDisplayableInfo(c)),
    [existingDisplayConcourses],
  );

  return (
    <Stack gap="lg">
      <Group gap="xs" justify="space-between">
        <Group gap="xs">
          {platforms.map((p) => (
            <LinkButton
              key={p.id}
              href={layoutHref(stationId, p.id)}
              variant={p.id === platform.id ? 'filled' : 'default'}
              size="sm"
              onClick={(e: React.MouseEvent) => handleTabClick(e, layoutHref(stationId, p.id))}
            >
              {p.platformNumber}番線
            </LinkButton>
          ))}
        </Group>
        <Button
          variant="default"
          size="sm"
          onClick={() => setCreatingPlatform((v) => !v)}
        >
          {creatingPlatform ? 'キャンセル' : '+ ホームを追加'}
        </Button>
      </Group>

      {creatingPlatform && (
        <PlatformInspector stationId={stationId} lines={lines} onCancel={() => setCreatingPlatform(false)} />
      )}

      <Card withBorder padding="lg">
        <Group gap="xs" mb="md" justify="space-between">
          <Group gap="xs">
            {platform.lineColor && <ColorSwatch color={platform.lineColor} size={12} />}
            <Text fw={600}>{platform.lineName}</Text>
            {(platform.inboundDirectionName || platform.outboundDirectionName) && (
              <Text size="sm" c="dimmed">
                {[platform.inboundDirectionName, platform.outboundDirectionName].filter(Boolean).join(' / ')}
              </Text>
            )}
            <Text size="sm" c="dimmed">
              {platform.physicalLength > 0 ? `ホーム長 ${platform.physicalLength}m` : 'ホーム長未入力'}
            </Text>
          </Group>
          <Group gap="xs">
            <Button variant="default" size="compact-sm" onClick={() => setEditingPlatform((v) => !v)}>
              {editingPlatform ? 'キャンセル' : 'ホーム情報を編集'}
            </Button>
            <Button
              variant="subtle"
              color="red"
              size="compact-sm"
              loading={deletingPlatform}
              onClick={() => requestDelete(`${platform.platformNumber}番ホーム`, deletePlatform)}
            >
              このホームを削除
            </Button>
          </Group>
        </Group>

        {editingPlatform && (
          <PlatformInspector
            stationId={stationId}
            lines={lines}
            initialData={{
              id: platform.id,
              platformNumber: platform.platformNumber,
              lineId: platform.lineId,
              inboundDirectionId: platform.inboundDirectionId,
              outboundDirectionId: platform.outboundDirectionId,
              physicalLength: platform.physicalLength,
              platformSide: platform.platformSide,
              notes: platform.notes,
            }}
            onCancel={() => setEditingPlatform(false)}
          />
        )}

        <Group gap="xs" mb="md" justify="space-between">
          {patternBaselines.length > 0 && (
            <Group gap="xs">
              {patternBaselines.map((sp) => (
                <LinkButton
                  key={sp.patternId}
                  href={layoutHref(stationId, platform.id, sp.patternId)}
                  variant={!newPattern && sp.patternId === platform.selectedPatternId ? 'filled' : 'default'}
                  size="compact-sm"
                  onClick={(e: React.MouseEvent) => handleTabClick(e, layoutHref(stationId, platform.id, sp.patternId))}
                >
                  {sp.trainLabel}
                  {dirtyPatternIds.includes(sp.patternId) && ' ●'}
                </LinkButton>
              ))}
            </Group>
          )}
          {!newPattern && (
            <Button
              variant="default"
              size="compact-sm"
              onClick={() => setCreatingPattern((v) => !v)}
            >
              {creatingPattern ? 'キャンセル' : '+ 停車位置を追加'}
            </Button>
          )}
        </Group>

        {creatingPattern && !newPattern && (
          <StopPatternCreateForm
            trains={trains}
            excludeTrainIds={patternBaselines.map((p) => p.trainId)}
            onPreview={handlePreviewNewPattern}
            onCancel={() => setCreatingPattern(false)}
          />
        )}

        {platform.physicalLength === 0 ? (
          <Text size="sm" c="dimmed" ta="center" py="md">
            ホーム長が未登録のため図を表示できません
          </Text>
        ) : !displayPattern ? (
          <Text size="sm" c="dimmed" fs="italic">列車情報がありません</Text>
        ) : (
          // min-w-0 は必須。無いと図のキャンバス幅まで膨らみ overflow-x-auto が効かない
          <div className="min-w-0">
            <PlatformDiagram
              pattern={displayPattern}
              physicalLength={platform.physicalLength}
              concourses={displayConcourses}
              platformSide={platform.platformSide}
              bounds={bounds}
              plateLayout={plateLayout}
              facingLayout={facingLayout}
              diagramOverlay={(rows) => (
                <DiagramEditLayer
                  rows={rows}
                  bounds={bounds}
                  physicalLength={platform.physicalLength}
                  cars={displayPattern.cars}
                  cellHandles={displayConcourses
                    .flatMap((c) => c.cells)
                    .filter((c) => c.xPositionMeters !== null)
                    .map((c) => ({ id: c.id, xPositionMeters: c.xPositionMeters as number }))}
                  selectedCellId={selectedCellId}
                  onSelectCell={selectCell}
                  onMoveCell={handleMoveCell}
                  onMoveCarBoundary={handleMoveCarBoundary}
                  onMoveCarEdge={handleMoveCarEdge}
                />
              )}
            />
          </div>
        )}
      </Card>

      {displayPattern && (
        <StopPatternInspector
          trainLabel={displayPattern.trainLabel}
          cars={displayPattern.cars}
          onMoveCarBoundary={handleMoveCarBoundary}
          onMoveCarEdge={handleMoveCarEdge}
          {...patternActions()}
          saving={newPattern ? savingPatternIds.has('__new_pattern__') : savingPatternIds.has(selectedPatternBaseline?.patternId ?? '')}
          deleting={selectedPatternBaseline ? deletingPatternIds.has(selectedPatternBaseline.patternId) : false}
          isNew={!!newPattern}
        />
      )}

      {/* コンコース一覧。既存 + 新規作成中（複製含む）の両方を並べる */}
      <Card withBorder padding="md">
        <Group justify="space-between" mb="sm">
          <Text size="sm" fw={600}>コンコース（設備場所）</Text>
          <Button variant="subtle" size="compact-sm" onClick={startNewConcourse} disabled={!!newConcourse}>
            + コンコースを追加
          </Button>
        </Group>
        <Stack gap="xs">
          {concourseBaselines.map((c) => {
            const label = exitsLabel(c) ?? connectionLabels(c)[0] ?? 'コンコース';
            return (
              <Group key={c.id} justify="space-between">
                <Button
                  variant={selectedConcourseId === c.id ? 'light' : 'subtle'}
                  size="compact-sm"
                  onClick={() => setSelectedConcourseId(c.id)}
                >
                  {label}
                  {dirtyConcourseIds.includes(c.id) && ' ●'}
                </Button>
                <Group gap={4}>
                  <Button variant="subtle" size="compact-xs" onClick={() => duplicateConcourse(c)}>複製</Button>
                  <Button
                    variant="subtle"
                    color="red"
                    size="compact-xs"
                    loading={deletingConcourseIds.has(c.id)}
                    onClick={() => requestDelete(label, () => deleteConcourse(c.id, label))}
                  >
                    削除
                  </Button>
                </Group>
              </Group>
            );
          })}
          {newConcourse && (
            <Group justify="space-between">
              <Button
                variant={selectedConcourseId === newConcourse.tempId ? 'light' : 'subtle'}
                size="compact-sm"
                onClick={() => setSelectedConcourseId(newConcourse.tempId)}
              >
                新規コンコース ●
              </Button>
            </Group>
          )}
          {concourseBaselines.length === 0 && !newConcourse && (
            <Text size="sm" c="dimmed" fs="italic">コンコースがまだ登録されていません</Text>
          )}
        </Stack>
      </Card>

      {selectedConcourseId && selectedConcourseDraft && (
        <ConcourseInspector
          draft={selectedConcourseDraft}
          facilityTypes={facilityTypes}
          connectedStations={connectedStations}
          onChange={(mutate) => updateConcourseDraft(selectedConcourseId, mutate)}
          {...concourseActions(selectedConcourseId)}
          saving={savingConcourseIds.has(selectedConcourseId)}
          deleting={deletingConcourseIds.has(selectedConcourseId)}
          isNew={newConcourse?.tempId === selectedConcourseId}
        />
      )}

      {/* 未保存の編集パネル。「すべて保存」は作らない
          （複数アグリゲートの逐次保存は原子的でなく、誤った保証になる） */}
      {isAnyDirty && (
        <Card withBorder padding="md" data-testid="unsaved-panel">
          <Text size="sm" fw={600} mb="xs">未保存の変更</Text>
          <Stack gap="xs">
            {concourseBaselines.filter((c) => dirtyConcourseIds.includes(c.id)).map((c) => (
              <Group key={c.id} justify="space-between">
                <Group gap="xs">
                  <Badge color="orange" size="sm">●</Badge>
                  <Text size="sm">{exitsLabel(c) ?? connectionLabels(c)[0] ?? 'コンコース'}</Text>
                </Group>
                <Button size="compact-sm" loading={savingConcourseIds.has(c.id)} onClick={() => saveConcourse(c)}>
                  保存
                </Button>
              </Group>
            ))}
            {newConcourse && (
              <Group justify="space-between">
                <Group gap="xs">
                  <Badge color="orange" size="sm">●</Badge>
                  <Text size="sm">新規コンコース</Text>
                </Group>
                <Button
                  size="compact-sm"
                  loading={savingConcourseIds.has(newConcourse.tempId)}
                  onClick={saveNewConcourse}
                >
                  保存
                </Button>
              </Group>
            )}
            {patternBaselines.filter((p) => dirtyPatternIds.includes(p.patternId)).map((p) => (
              <Group key={p.patternId} justify="space-between">
                <Group gap="xs">
                  <Badge color="orange" size="sm">●</Badge>
                  <Text size="sm">{p.trainLabel} の停車位置</Text>
                </Group>
                <Button size="compact-sm" loading={savingPatternIds.has(p.patternId)} onClick={() => savePattern(p)}>
                  保存
                </Button>
              </Group>
            ))}
            {newPattern && newPatternTrain && (
              <Group justify="space-between">
                <Group gap="xs">
                  <Badge color="orange" size="sm">●</Badge>
                  <Text size="sm">{newPatternTrain.name} の停車位置（新規）</Text>
                </Group>
                <Button size="compact-sm" loading={savingPatternIds.has('__new_pattern__')} onClick={saveNewPattern}>
                  保存
                </Button>
              </Group>
            )}
          </Stack>
        </Card>
      )}

      {/* 座標を持たないコンコース（#51見える化）。「位置を入力」で図の中央付近に
          仮置きされ選択状態になる（US-4）。新規作成中のコンコースはここに出さない
          （ユーザーが今まさにインスペクタで編集中のため） */}
      {undrawableConcourses.length > 0 && (
        <div data-testid="undrawable-section">
          <Text size="xs" fw={600} c="dimmed" tt="uppercase" mb={4}>
            位置未登録の設備・乗換
          </Text>
          <Text size="xs" c="dimmed" mb="xs">
            ホーム上の位置が登録されていないため、図には表示していません。
          </Text>
          <Stack gap="xs">
            {undrawableConcourses.map((concourse) => {
              const exits = exitsLabel(concourse);
              const connections = connectionLabels(concourse);
              const facilityNames = [
                ...new Set(concourse.cells.flatMap((cell) => cell.facilities.map((f) => f.typeName))),
              ];
              return (
                <Group key={concourse.id} justify="space-between" align="flex-start">
                  <div>
                    {exits && <Text size="sm" fw={500}>{exits}</Text>}
                    {connections.length > 0 && (
                      <Text size="sm" c="dimmed">乗換: {connections.join('・')}</Text>
                    )}
                    {facilityNames.length > 0 && (
                      <Group gap={6} mt={2}>
                        {facilityNames.map((name) => (
                          <Badge key={name} variant="light" color="gray" size="sm">{name}</Badge>
                        ))}
                      </Group>
                    )}
                  </div>
                  <Button variant="default" size="compact-sm" onClick={() => fillPositionsForConcourse(concourse)}>
                    位置を入力
                  </Button>
                </Group>
              );
            })}
          </Stack>
        </div>
      )}

      <Modal opened={confirmOpened} onClose={closeConfirm} title="未保存の変更があります" centered>
        <Text mb="lg">保存していない変更は失われます。移動しますか？</Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={closeConfirm}>キャンセル</Button>
          <Button color="red" onClick={confirmDiscardAndNavigate}>変更を破棄して移動</Button>
        </Group>
      </Modal>

      <Modal opened={deleteConfirmOpened} onClose={closeDeleteConfirm} title="削除確認" centered>
        <Text mb="lg">{pendingDelete?.label} を削除します。よろしいですか？</Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={closeDeleteConfirm}>キャンセル</Button>
          <Button color="red" onClick={confirmDelete}>削除する</Button>
        </Group>
      </Modal>
    </Stack>
  );
}
