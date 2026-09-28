'use client';

import { useState } from 'react';
import {
  PERSONA_LABEL,
  REQUIREMENT_LABEL,
  assessRoutes,
  detourMinutes,
  requirementFor,
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

// Tailwind はクラス名を静的に拾うので、クラス名は組み立てずに文字列リテラルで持つ
const PERSONA_STYLE: Record<Persona, { backgroundColor: string; divideClass: string }> = {
  stroller: { backgroundColor: '#FCE4EC', divideClass: 'divide-pink-200' },
  wheelchair: { backgroundColor: '#E3F2FD', divideClass: 'divide-blue-200' },
};

const HIGHLIGHT = 'bg-yellow-100 font-semibold';

function StatusIcon({ iconPath, iconColorHex }: { iconPath: string; iconColorHex: string }) {
  return (
    <span
      aria-hidden
      className="flex-shrink-0 mt-0.5"
      style={{
        display: 'inline-block',
        width: 20,
        height: 20,
        backgroundColor: iconColorHex,
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
      className={`inline-block rounded px-1.5 py-0.5 text-[11px] leading-tight border border-gray-200 ${
        highlighted ? HIGHLIGHT : 'bg-white/70 text-gray-700'
      }`}
    >
      {children}
    </span>
  );
}

function RouteItem({
  persona,
  route,
  highlights,
}: {
  persona: Persona;
  route: TransferRouteDTO;
  highlights: Set<RouteField>;
}) {
  const requirement = requirementFor(persona, route.facilities);
  return (
    <li className="py-2 first:pt-0 last:pb-0">
      <p className="text-xs text-gray-800 font-medium">
        {route.label}
        {route.minutes !== null && (
          <span className={`ml-1.5 font-normal ${highlights.has('minutes') ? HIGHLIGHT : 'text-gray-600'}`}>
            {route.minutes}分
          </span>
        )}
      </p>
      <div className="mt-1 flex flex-wrap gap-1">
        {/* 設備0件（未入力）から必要な行為を導出しない（ADR-0012）。未入力である旨も利用者には出さない（#135） */}
        {requirement !== null && (
          <Chip highlighted={highlights.has('requirement')}>{REQUIREMENT_LABEL[requirement]}</Chip>
        )}
        {route.isOutdoor && <Chip highlighted={highlights.has('isOutdoor')}>{ROUTE_FLAG_LABEL.isOutdoor}</Chip>}
        {route.requiresExitGate && (
          <Chip highlighted={highlights.has('requiresExitGate')}>{ROUTE_FLAG_LABEL.requiresExitGate}</Chip>
        )}
        {route.requiresStaff && (
          <Chip highlighted={highlights.has('requiresStaff')}>{ROUTE_FLAG_LABEL.requiresStaff}</Chip>
        )}
        {!route.isOfficiallyGuided && (
          <Chip highlighted={highlights.has('isOfficiallyGuided')}>{ROUTE_FLAG_LABEL.notOfficiallyGuided}</Chip>
        )}
      </div>
      {route.notes && <p className="mt-1 text-xs text-gray-600 whitespace-pre-wrap">{route.notes}</p>}
    </li>
  );
}

function detourText(minutes: number): string {
  if (minutes === 0) return '一般的なルートと同じ所要時間';
  return minutes > 0 ? `一般的なルートより ${minutes}分長い` : `一般的なルートより ${-minutes}分短い`;
}

function PersonaCard({ persona, routes }: { persona: Persona; routes: TransferRouteDTO[] }) {
  const style = PERSONA_STYLE[persona];
  const assessment = assessRoutes(persona, routes);

  let body: React.ReactNode;
  if (assessment.kind === 'unevaluated') {
    body = <p className="text-xs text-gray-500 italic">情報なし</p>;
  } else {
    const meta = TRANSFER_STATUS_META[assessment.kind];
    let detail: React.ReactNode = null;
    if (assessment.kind === 'barrierFree') {
      const highlights = assessment.routes.length > 1 ? differingFields(persona, assessment.routes) : new Set<RouteField>();
      const detour = detourMinutes(persona, routes);
      const shortest = assessment.routes[0];
      const shortestRequirement = shortest ? requirementFor(persona, shortest.facilities) : null;
      detail = (
        <>
          <ul className={`mt-2 divide-y ${style.divideClass}`}>
            {assessment.routes.map((route) => (
              <RouteItem key={route.routeId} persona={persona} route={route} highlights={highlights} />
            ))}
          </ul>
          {/* 迂回度は差に距離と移動速度の差が混ざるため、必要な行為と並べて出す（迂回度0でも行為が要る接続がある） */}
          {detour !== null && shortestRequirement !== null && (
            <p className="mt-2 text-xs text-gray-700">
              最短のバリアフリールート: {detourText(detour)}（{REQUIREMENT_LABEL[shortestRequirement]}）
            </p>
          )}
        </>
      );
    } else {
      const lightest = assessment.lightest;
      // 設備未入力のルートの存在・名前は利用者に出さない（補完は管理者の作業。#135）。
      // undetermined の最も軽い行為は、未入力のルートの方が軽い可能性があるので「確認できているルートでは」と限定する
      let lightestText: string | null = null;
      if (lightest !== null) {
        lightestText = `${assessment.kind === 'undetermined' ? '確認できているルートでは、' : ''}最も軽い方法: ${REQUIREMENT_LABEL[lightest]}`;
      } else if (assessment.kind === 'none') {
        lightestText = '通行可能なルートがありません';
      }
      detail = lightestText && <p className="mt-1 text-xs text-gray-700">{lightestText}</p>;
    }
    body = (
      <>
        <div className="flex items-start gap-2">
          <StatusIcon iconPath={meta.iconPath} iconColorHex={meta.iconColorHex} />
          <p className="text-xs text-gray-700 leading-snug">
            {meta.label}
            {assessment.kind === 'barrierFree' && assessment.routes.length > 1 && `（${assessment.routes.length}本）`}
          </p>
        </div>
        {detail}
      </>
    );
  }

  return (
    <section
      aria-label={PERSONA_LABEL[persona]}
      className="rounded-lg border border-gray-100 p-3"
      style={{ backgroundColor: style.backgroundColor }}
    >
      <p className="text-xs font-semibold text-gray-600 mb-2">{PERSONA_LABEL[persona]}</p>
      {body}
    </section>
  );
}

export function TransferDifficultySection({ stationName, partners: allPartners }: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // 評価済みの相手駅が1つも無い駅では出さない（未評価の相手駅は選べば「情報なし」と出る）
  if (!allPartners.some((p) => p.combos.length > 0)) return null;
  // 開いた直後に「情報なし」が出ないよう、評価済みの相手駅を先に並べる（それぞれの中では元の順序を保つ）
  const partners = [
    ...allPartners.filter((p) => p.combos.length > 0),
    ...allPartners.filter((p) => p.combos.length === 0),
  ];

  // partners が縮んで selectedIndex が範囲外になっても先頭にフォールバックする
  const selected = partners[selectedIndex] ?? partners[0];
  if (!selected) return null;
  const groups = groupCombos(selected);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-5">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        バリアフリールート整備状況
      </h2>

      {/* 路線ドロップダウン */}
      {partners.length > 1 ? (
        <div className="mb-4">
          <label htmlFor="transfer-partner" className="block text-xs text-gray-500 mb-1">乗換先路線</label>
          <select
            id="transfer-partner"
            value={selectedIndex}
            onChange={(e) => setSelectedIndex(Number(e.target.value))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            {partners.map((partner, i) => (
              <option key={`${partner.connectedStationId}:${partner.lineName}`} value={i}>
                {partner.connectedStationName === stationName
                  ? partner.lineName
                  : `${partner.lineName}（${partner.connectedStationName}）`}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="mb-4 flex items-center gap-2">
          {selected.lineColor && (
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: selected.lineColor }}
            />
          )}
          <span className="text-sm font-medium text-gray-700">{selected.lineName}</span>
        </div>
      )}

      <div className="space-y-4">
        {groups.map((group, i) => (
          <div key={group.heading ?? i}>
            {group.heading && <h3 className="text-xs font-semibold text-gray-700 mb-2">{group.heading}</h3>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <PersonaCard persona="stroller" routes={group.routes} />
              <PersonaCard persona="wheelchair" routes={group.routes} />
            </div>
            {group.notes && (
              <p className="text-xs text-gray-600 mt-2 whitespace-pre-wrap">{group.notes}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
