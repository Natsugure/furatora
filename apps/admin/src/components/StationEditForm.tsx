'use client';

import { useRouter } from 'next/navigation';
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

type ConnectionState = {
  strollerDifficulty: StrollerDifficulty | '';
  wheelchairDifficulty: WheelchairDifficulty | '';
  notesAboutStroller: string;
  notesAboutWheelchair: string;
};

type Props = {
  stationId: string;
  initialNameKana: string | null;
  initialNotes: string | null;
  connections: ConnectionRow[];
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

export function StationEditForm({ stationId, initialNameKana, initialNotes, connections }: Props) {
  const router = useRouter();
  const [nameKana, setNameKana] = useState(initialNameKana ?? '');
  const [notes, setNotes] = useState(initialNotes ?? '');
  const [connectionStates, setConnectionStates] = useState<Record<string, ConnectionState>>(() =>
    Object.fromEntries(
      connections.map((c) => [
        c.id,
        {
          strollerDifficulty: c.strollerDifficulty ?? '',
          wheelchairDifficulty: c.wheelchairDifficulty ?? '',
          notesAboutStroller: c.notesAboutStroller ?? '',
          notesAboutWheelchair: c.notesAboutWheelchair ?? '',
        },
      ])
    )
  );
  const [submitting, setSubmitting] = useState(false);

  function updateConnection(id: string, patch: Partial<ConnectionState>) {
    setConnectionStates((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function handleSave() {
    setSubmitting(true);

    const stationReq = fetch(`/api/stations/${stationId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nameKana: nameKana || null,
        notes: notes || null,
      }),
    });

    const connectionReqs = connections.map((conn) => {
      const s = connectionStates[conn.id];
      return fetch(`/api/station-connections/${conn.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strollerDifficulty: s.strollerDifficulty || null,
          wheelchairDifficulty: s.wheelchairDifficulty || null,
          notesAboutStroller: s.notesAboutStroller || null,
          notesAboutWheelchair: s.notesAboutWheelchair || null,
        }),
      });
    });

    const results = await Promise.all([stationReq, ...connectionReqs]);
    const allOk = results.every((r) => r.ok);

    if (allOk) {
      router.push('/stations');
      router.refresh();
    } else {
      setSubmitting(false);
      alert('Failed to save');
    }
  }

  return (
    <div className="max-w-3xl space-y-10">
      {/* 駅情報 */}
      <section className="space-y-4">
        <h3 className="text-base font-semibold">駅情報</h3>

        <div>
          <label className="block text-sm font-medium mb-1">よみがな - Optional</label>
          <input
            type="text"
            value={nameKana}
            onChange={(e) => setNameKana(e.target.value)}
            placeholder="例: かやばちょう"
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">備考 - Optional</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="例: 東急東横線との直通運転あり"
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </div>
      </section>

      {/* 乗り換え接続 */}
      <section>
        <h3 className="text-base font-semibold mb-3">
          乗り換え接続 ({connections.length}件)
        </h3>

        {connections.length === 0 ? (
          <p className="text-sm text-gray-400 italic">乗り換え接続情報がありません</p>
        ) : (
          <div className="space-y-6">
            {connections.map((conn) => {
              const s = connectionStates[conn.id];
              return (
                <div key={conn.id} className="border rounded-lg p-4 bg-white">
                  <p className="font-medium text-sm mb-4">{displayName(conn)}</p>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        ベビーカー難易度
                      </label>
                      <select
                        value={s.strollerDifficulty}
                        onChange={(e) =>
                          updateConnection(conn.id, {
                            strollerDifficulty: e.target.value as StrollerDifficulty | '',
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

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        車いす難易度
                      </label>
                      <select
                        value={s.wheelchairDifficulty}
                        onChange={(e) =>
                          updateConnection(conn.id, {
                            wheelchairDifficulty: e.target.value as WheelchairDifficulty | '',
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

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        ベビーカー備考
                      </label>
                      <textarea
                        value={s.notesAboutStroller}
                        onChange={(e) =>
                          updateConnection(conn.id, { notesAboutStroller: e.target.value })
                        }
                        rows={2}
                        placeholder="例: A2出口エレベーターを利用"
                        className="w-full border rounded px-2 py-1.5 text-sm resize-y"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        車いす備考
                      </label>
                      <textarea
                        value={s.notesAboutWheelchair}
                        onChange={(e) =>
                          updateConnection(conn.id, { notesAboutWheelchair: e.target.value })
                        }
                        rows={2}
                        placeholder="例: 駅員への申告が必要"
                        className="w-full border rounded px-2 py-1.5 text-sm resize-y"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 一括保存ボタン */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          disabled={submitting}
          onClick={handleSave}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? 'Saving...' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/stations')}
          className="px-4 py-2 border rounded hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
