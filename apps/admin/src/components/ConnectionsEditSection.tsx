'use client';

import { useState } from 'react';
import type { StrollerDifficulty, WheelchairDifficulty } from '@furatora/database/enums';
import { STROLLER_DIFFICULTY_META, WHEELCHAIR_DIFFICULTY_META } from '@/constants/difficulty';

export type ConnectionRow = {
  id: string;
  connectedStationName: string | null;
  connectedLineName: string | null;
  odptStationId: string | null;
  odptRailwayId: string | null;
  strollerDifficulty: StrollerDifficulty | null;
  wheelchairDifficulty: WheelchairDifficulty | null;
  notesAboutStroller: string | null;
  notesAboutWheelchair: string | null;
};

type ConnectionFormState = {
  strollerDifficulty: StrollerDifficulty | '';
  wheelchairDifficulty: WheelchairDifficulty | '';
  notesAboutStroller: string;
  notesAboutWheelchair: string;
  saving: boolean;
  saved: boolean;
};

function displayName(conn: ConnectionRow): string {
  if (conn.connectedStationName && conn.connectedLineName) {
    return `${conn.connectedLineName} — ${conn.connectedStationName}`;
  }
  if (conn.connectedLineName) return conn.connectedLineName;
  if (conn.connectedStationName) return conn.connectedStationName;
  const railway = conn.odptRailwayId?.replace('odpt.Railway:', '') ?? '';
  const station = conn.odptStationId?.replace('odpt.Station:', '') ?? '';
  return station || railway || '(不明)';
}

type Props = {
  connections: ConnectionRow[];
};

export function ConnectionsEditSection({ connections }: Props) {
  const [states, setStates] = useState<Record<string, ConnectionFormState>>(() =>
    Object.fromEntries(
      connections.map((c) => [
        c.id,
        {
          strollerDifficulty: c.strollerDifficulty ?? '',
          wheelchairDifficulty: c.wheelchairDifficulty ?? '',
          notesAboutStroller: c.notesAboutStroller ?? '',
          notesAboutWheelchair: c.notesAboutWheelchair ?? '',
          saving: false,
          saved: false,
        },
      ])
    )
  );

  function update(id: string, patch: Partial<ConnectionFormState>) {
    setStates((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function handleSave(id: string) {
    const s = states[id];
    update(id, { saving: true, saved: false });
    const res = await fetch(`/api/station-connections/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        strollerDifficulty: s.strollerDifficulty || null,
        wheelchairDifficulty: s.wheelchairDifficulty || null,
        notesAboutStroller: s.notesAboutStroller || null,
        notesAboutWheelchair: s.notesAboutWheelchair || null,
      }),
    });
    if (res.ok) {
      update(id, { saving: false, saved: true });
    } else {
      update(id, { saving: false });
      alert('Failed to save');
    }
  }

  if (connections.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic">乗り換え接続情報がありません</p>
    );
  }

  return (
    <div className="space-y-6">
      {connections.map((conn) => {
        const s = states[conn.id];
        return (
          <div key={conn.id} className="border rounded-lg p-4 bg-white">
            <p className="font-medium text-sm mb-4">{displayName(conn)}</p>

            <div className="grid grid-cols-2 gap-4 mb-4">
              {/* ベビーカー難易度 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  ベビーカー難易度
                </label>
                <select
                  value={s.strollerDifficulty}
                  onChange={(e) =>
                    update(conn.id, {
                      strollerDifficulty: e.target.value as StrollerDifficulty | '',
                      saved: false,
                    })
                  }
                  className="w-full border rounded px-2 py-1.5 text-sm"
                >
                  <option value="">— 未設定 —</option>
                  {Object.entries(STROLLER_DIFFICULTY_META)
                    .sort(([, a], [, b]) => a.order - b.order)
                    .map(([key, { label }]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                </select>
              </div>

              {/* 車いす難易度 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  車いす難易度
                </label>
                <select
                  value={s.wheelchairDifficulty}
                  onChange={(e) =>
                    update(conn.id, {
                      wheelchairDifficulty: e.target.value as WheelchairDifficulty | '',
                      saved: false,
                    })
                  }
                  className="w-full border rounded px-2 py-1.5 text-sm"
                >
                  <option value="">— 未設定 —</option>
                  {Object.entries(WHEELCHAIR_DIFFICULTY_META)
                    .sort(([, a], [, b]) => a.order - b.order)
                    .map(([key, { label }]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              {/* ベビーカー備考 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  ベビーカー備考
                </label>
                <textarea
                  value={s.notesAboutStroller}
                  onChange={(e) =>
                    update(conn.id, { notesAboutStroller: e.target.value, saved: false })
                  }
                  rows={2}
                  placeholder="例: A2出口エレベーターを利用"
                  className="w-full border rounded px-2 py-1.5 text-sm resize-y"
                />
              </div>

              {/* 車いす備考 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  車いす備考
                </label>
                <textarea
                  value={s.notesAboutWheelchair}
                  onChange={(e) =>
                    update(conn.id, { notesAboutWheelchair: e.target.value, saved: false })
                  }
                  rows={2}
                  placeholder="例: 駅員への申告が必要"
                  className="w-full border rounded px-2 py-1.5 text-sm resize-y"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={s.saving}
                onClick={() => handleSave(conn.id)}
                className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {s.saving ? 'Saving...' : 'Save'}
              </button>
              {s.saved && (
                <span className="text-xs text-green-600">保存しました</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
