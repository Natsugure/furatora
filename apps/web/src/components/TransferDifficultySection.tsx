'use client';

import { useState } from 'react';
import { SegmentedControl } from '@mantine/core';
import { ChevronDown } from 'lucide-react';
import {
  PERSONA_LABEL,
  REQUIREMENT_LABEL,
  assessRoutes,
  type AssessedRoute,
  type Assessment,
  type Persona,
} from '@furatora/transfer-difficulty/domain';
import type { TransferPartnerDTO, TransferRouteDTO } from '@/features/station/domain/types';
import { differingFields, groupCombos, type RouteField } from '@/features/station/domain/transferView';
import { ROUTE_FLAG_LABEL, TRANSFER_STATUS_META } from '@/constants/transferDifficulty';

type Props = {
  /** 自駅の駅名。相手駅の駅名が違うときだけ、選択肢に駅名を添える */
  stationName: string;
  partners: TransferPartnerDTO[];
};

const PERSONAS: Persona[] = ['stroller', 'wheelchair'];

// SegmentedControl の onChange は string を返すため、Persona に絞り込む
function isPersona(value: string): value is Persona {
  return PERSONAS.some((p) => p === value);
}

// 移動手段ごとの面と強調の色。ベビーカーはブランドのローズ、車いすはスレート（ADR-0018）。
// Tailwind はクラス名を静的に拾うので、クラス名は組み立てずに文字列リテラルで持つ
const PERSONA_STYLE: Record<Persona, { cardClass: string; activeClass: string }> = {
  stroller: { cardClass: 'bg-brand-50', activeClass: 'data-[active]:text-brand-600' },
  wheelchair: { cardClass: 'bg-wheelchair-50', activeClass: 'data-[active]:text-wheelchair-700' },
};

// ルートが複数あるときに、ルートの間で違う項目を目立たせる
const HIGHLIGHT = 'bg-brand-100 text-brand-800 font-semibold';

function StatusIcon({ iconPath, iconColor }: { iconPath: string; iconColor: string }) {
  return (
    <span
      aria-hidden
      className="flex-shrink-0 mt-0.5"
      style={{
        display: 'inline-block',
        width: 20,
        height: 20,
        backgroundColor: iconColor,
        WebkitMaskImage: `url(${iconPath})`,
        WebkitMaskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskImage: `url(${iconPath})`,
        maskSize: 'contain',
        maskRepeat: 'no-repeat',
      }}
    />
  );
}

function Chip({ children, highlighted }: { children: React.ReactNode; highlighted: boolean }) {
  return (
    <span
      className={`inline-block rounded-tag px-2 py-1 text-[11px] font-bold leading-tight ${
        highlighted ? HIGHLIGHT : 'bg-surface text-ink-soft'
      }`}
    >
      {children}
    </span>
  );
}

// バリアフリールートの1本。設備が入力済みのルートだけが来るので、必要な行為は常にある（assessRoutes が導出済み）
function RouteItem({
  assessed: { route, requirement },
  highlights,
}: {
  assessed: AssessedRoute<TransferRouteDTO>;
  highlights: Set<RouteField>;
}) {
  const flags: [RouteField, boolean, string][] = [
    ['isOutdoor', route.isOutdoor, ROUTE_FLAG_LABEL.isOutdoor],
    ['requiresExitGate', route.requiresExitGate, ROUTE_FLAG_LABEL.requiresExitGate],
    ['requiresStaff', route.requiresStaff, ROUTE_FLAG_LABEL.requiresStaff],
    ['isOfficiallyGuided', !route.isOfficiallyGuided, ROUTE_FLAG_LABEL.notOfficiallyGuided],
  ];
  return (
    <li className="py-2 first:pt-0 last:pb-0">
      <p className="font-display font-bold text-[15px] leading-snug text-ink">
        {route.label}
        {route.minutes !== null && (
          <span className={`ml-1.5 font-normal ${highlights.has('minutes') ? HIGHLIGHT : 'text-muted'}`}>
            {route.minutes}分
          </span>
        )}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1">
        <Chip highlighted={highlights.has('requirement')}>{REQUIREMENT_LABEL[requirement]}</Chip>
        {flags.map(
          ([field, shown, label]) =>
            shown && (
              <Chip key={field} highlighted={highlights.has(field)}>
                {label}
              </Chip>
            ),
        )}
      </div>
      {route.notes && <p className="mt-1 text-xs text-ink-soft whitespace-pre-wrap">{route.notes}</p>}
    </li>
  );
}

function detourText(minutes: number): string {
  if (minutes === 0) return '一般的なルートと同じ所要時間';
  return minutes > 0 ? `一般的なルートより ${minutes}分長い` : `一般的なルートより ${-minutes}分短い`;
}

type BarrierFreeAssessment = Extract<Assessment<TransferRouteDTO>, { kind: 'barrierFree' }>;

function BarrierFreeDetail({ assessment }: { assessment: BarrierFreeAssessment }) {
  const { routes, detour } = assessment;
  const highlights = routes.length > 1 ? differingFields(routes) : new Set<RouteField>();
  // routes は1本以上あり、先頭が最短
  const shortest = routes[0]!;
  return (
    <>
      <ul className="mt-3 divide-y divide-ink/10">
        {routes.map((assessed) => (
          <RouteItem key={assessed.route.routeId} assessed={assessed} highlights={highlights} />
        ))}
      </ul>
      {/* 迂回度は差に距離と移動速度の差が混ざるため、必要な行為と並べて出す（迂回度0でも行為が要る接続がある） */}
      {detour !== null && (
        <p className="mt-3 text-xs text-ink-soft">
          最短のバリアフリールート: {detourText(detour)}（{REQUIREMENT_LABEL[shortest.requirement]}）
        </p>
      )}
    </>
  );
}

// 設備未入力のルートの存在・名前は利用者に出さない（補完は管理者の作業。#135）。
// undetermined の最も軽い行為は、未入力のルートの方が軽い可能性があるので「確認できているルートでは」と限定する
function lightestText(assessment: Extract<Assessment<TransferRouteDTO>, { kind: 'undetermined' | 'none' }>) {
  const { kind, lightest } = assessment;
  if (lightest !== null) {
    return `${kind === 'undetermined' ? '確認できているルートでは、' : ''}最も軽い方法: ${REQUIREMENT_LABEL[lightest]}`;
  }
  return kind === 'none' ? '通行可能なルートがありません' : null;
}

function PersonaBody({ persona, routes }: { persona: Persona; routes: TransferRouteDTO[] }) {
  const assessment = assessRoutes(persona, routes);
  if (assessment.kind === 'unevaluated') {
    return <p className="text-sm text-muted">情報なし</p>;
  }

  const meta = TRANSFER_STATUS_META[assessment.kind];
  const text = assessment.kind === 'barrierFree' ? null : lightestText(assessment);
  return (
    <>
      <div className="flex items-start gap-2">
        <StatusIcon iconPath={meta.iconPath} iconColor={meta.iconColor} />
        <p className={`text-[15px] font-bold leading-snug ${meta.labelClassName}`}>
          {meta.label}
          {assessment.kind === 'barrierFree' && assessment.routes.length > 1 && `（${assessment.routes.length}本）`}
        </p>
      </div>
      {assessment.kind === 'barrierFree' ? (
        <BarrierFreeDetail assessment={assessment} />
      ) : (
        text && <p className="mt-1.5 text-xs text-ink-soft">{text}</p>
      )}
    </>
  );
}

function PersonaCard({ persona, routes }: { persona: Persona; routes: TransferRouteDTO[] }) {
  return (
    <section aria-label={PERSONA_LABEL[persona]} className={`rounded-card p-5 ${PERSONA_STYLE[persona].cardClass}`}>
      <PersonaBody persona={persona} routes={routes} />
    </section>
  );
}

export function TransferDifficultySection({ stationName, partners: allPartners }: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  // 開いた直後はベビーカー（REQ-7）。選択は URL に載せない（design.md「データフロー」）
  const [persona, setPersona] = useState<Persona>('stroller');

  // 未評価は「ルートが0本」（docs/domain/station-master-model.md）。接続行の有無ではなくルートの有無で判定する
  const isEvaluated = (p: TransferPartnerDTO) => p.combos.some((c) => c.routes.length > 0);
  const evaluated = allPartners.filter(isEvaluated);
  // 評価済みの相手駅が1つも無い駅では出さない（未評価の相手駅は選べば「情報なし」と出る）
  if (evaluated.length === 0) return null;
  // 開いた直後に「情報なし」が出ないよう、評価済みの相手駅を先に並べる（それぞれの中では元の順序を保つ）
  const partners = [...evaluated, ...allPartners.filter((p) => !isEvaluated(p))];

  // partners が縮んで selectedIndex が範囲外になっても先頭にフォールバックする（evaluated が空でないので必ずある）
  const selected = partners[selectedIndex] ?? partners[0]!;
  const groups = groupCombos(selected);

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display font-bold text-lg text-ink">
        乗り換えのバリアフリールート
      </h2>

      {/* 路線ドロップダウン */}
      {partners.length > 1 ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="transfer-partner" className="text-xs font-medium text-muted">乗換先路線</label>
          <div className="relative">
            <select
              id="transfer-partner"
              value={selectedIndex}
              onChange={(e) => setSelectedIndex(Number(e.target.value))}
              className="w-full h-13.5 pl-4.5 pr-11 rounded-input bg-canvas shadow-[inset_0_0_0_1.5px_var(--color-border-default)] text-base text-ink appearance-none"
            >
              {partners.map((partner, i) => (
                <option key={`${partner.connectedStationId}:${partner.lineName}`} value={i}>
                  {partner.connectedStationName === stationName
                    ? partner.lineName
                    : `${partner.lineName}（${partner.connectedStationName}）`}
                </option>
              ))}
            </select>
            <ChevronDown size={18} strokeWidth={2.4} aria-hidden className="absolute right-4.5 top-1/2 -translate-y-1/2 text-brand-600 pointer-events-none" />
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          {selected.lineColor && (
            <span
              className="size-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: selected.lineColor }}
            />
          )}
          <span className="text-sm font-medium text-ink">{selected.lineName}</span>
        </div>
      )}

      {/* 移動手段の切り替え。SearchTabs と同じ部品（ラジオボタンのグループ）にそろえる */}
      <SegmentedControl
        fullWidth
        aria-label="移動手段"
        value={persona}
        onChange={(value) => { if (isPersona(value)) setPersona(value); }}
        data={PERSONAS.map((p) => ({ value: p, label: PERSONA_LABEL[p] }))}
        classNames={{
          root: 'p-1 rounded-full bg-subtle',
          indicator: 'rounded-full bg-surface shadow-raised',
          label: `flex items-center justify-center h-11.5 py-0 rounded-full text-sm font-medium text-ink-soft hover:text-ink data-[active]:font-bold ${PERSONA_STYLE[persona].activeClass}`,
        }}
      />

      <div className="flex flex-col gap-4">
        {groups.map((group, i) => (
          <div key={group.heading ?? i}>
            {group.heading && <h3 className="text-sm font-bold text-ink-soft mb-2">{group.heading}</h3>}
            <PersonaCard persona={persona} routes={group.routes} />
            {group.notes && (
              <p className="text-xs text-ink-soft mt-2 whitespace-pre-wrap">{group.notes}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
