'use client';

import { useEffect, useState } from 'react';

type Operator = { id: string; name: string; odptOperatorId: string | null };

type UnresolvedRailway = {
  odptRailwayId: string;
  referenceCount: number;
  referencingStationNames: string[];
  operatorKey: string;
  suggestedName: string;
};

type UnresolvedStation = {
  odptStationId: string;
  odptRailwayId: string | null;
  referenceCount: number;
  referencingStationNames: string[];
  operatorKey: string;
  suggestedLineName: string;
  suggestedName: string;
};

type AllStation = { id: string; name: string; code: string | null; operatorId: string };

// ───── Operator Section ────────────────────────────────────────────────────

function OperatorSection({
  operators,
  onCreated,
}: {
  operators: Operator[];
  onCreated: (op: Operator) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [odptOperatorId, setOdptOperatorId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setSubmitting(true);
    const res = await fetch('/api/operators', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), odptOperatorId: odptOperatorId || null }),
    });
    if (res.ok) {
      const op = await res.json();
      onCreated(op);
      setName('');
      setOdptOperatorId('');
      setOpen(false);
    } else {
      alert('作成に失敗しました');
    }
    setSubmitting(false);
  }

  return (
    <section className="border rounded p-4 bg-gray-50">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">
          登録済み事業者 ({operators.length}件)：
          {operators.map((o) => o.name).join('、')}
        </h2>
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-sm text-blue-600 hover:underline"
        >
          {open ? 'キャンセル' : '+ 事業者を追加'}
        </button>
      </div>
      {open && (
        <div className="mt-3 flex items-end gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">名称 *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: JR東日本"
              className="border rounded px-2 py-1.5 text-sm w-40"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">ODPT ID</label>
            <input
              value={odptOperatorId}
              onChange={(e) => setOdptOperatorId(e.target.value)}
              placeholder="odpt.Operator:JR-East"
              className="border rounded px-2 py-1.5 text-sm w-56"
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={submitting || !name.trim()}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
          >
            作成
          </button>
        </div>
      )}
    </section>
  );
}

// ───── Railway Row ─────────────────────────────────────────────────────────

function RailwayRow({
  railway,
  operators,
  isExpanded,
  onToggle,
  onResolved,
}: {
  railway: UnresolvedRailway;
  operators: Operator[];
  isExpanded: boolean;
  onToggle: () => void;
  onResolved: () => void;
}) {
  const [name, setName] = useState(railway.suggestedName);
  const [nameEn, setNameEn] = useState(railway.suggestedName);
  const [operatorId, setOperatorId] = useState('');
  const [lineCode, setLineCode] = useState('');
  const [color, setColor] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 事業者キーが一致する事業者を初期選択
  useEffect(() => {
    const match = operators.find((o) =>
      o.odptOperatorId?.toLowerCase().includes(railway.operatorKey.toLowerCase())
    );
    if (match) setOperatorId(match.id);
  }, [operators, railway.operatorKey]);

  async function handleSubmit() {
    if (!name.trim() || !operatorId) return;
    setSubmitting(true);
    const res = await fetch('/api/unresolved-connections/railways', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ odptRailwayId: railway.odptRailwayId, name, nameEn, operatorId, lineCode, color }),
    });
    if (res.ok) {
      onResolved();
    } else {
      alert('作成に失敗しました');
    }
    setSubmitting(false);
  }

  return (
    <div className="border-b last:border-b-0">
      <div className="flex items-center px-4 py-3 gap-4">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-mono text-gray-600 truncate">{railway.odptRailwayId}</div>
          <div className="text-xs text-gray-400 mt-0.5">
            {railway.referencingStationNames.slice(0, 5).join('・')}
            {railway.referencingStationNames.length > 5 && ` 他${railway.referencingStationNames.length - 5}駅`}
          </div>
        </div>
        <span className="text-xs text-gray-500 shrink-0">{railway.referenceCount}件</span>
        <button
          onClick={onToggle}
          className="text-sm text-blue-600 hover:underline shrink-0"
        >
          {isExpanded ? '閉じる' : '解決'}
        </button>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 bg-blue-50 border-t flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">路線名 *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border rounded px-2 py-1.5 text-sm w-32"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">英語名</label>
            <input
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              className="border rounded px-2 py-1.5 text-sm w-32"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">事業者 *</label>
            <select
              value={operatorId}
              onChange={(e) => setOperatorId(e.target.value)}
              required
              className="border rounded px-2 py-1.5 text-sm"
            >
              <option value="">選択</option>
              {operators.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">路線コード</label>
            <input
              value={lineCode}
              onChange={(e) => setLineCode(e.target.value)}
              placeholder="例: JC"
              className="border rounded px-2 py-1.5 text-sm w-20"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">カラー</label>
            <input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="#F15A22"
              className="border rounded px-2 py-1.5 text-sm w-24"
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting || !name.trim() || !operatorId}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? '作成中...' : '路線を作成'}
          </button>
        </div>
      )}
    </div>
  );
}

// ───── Station Row ─────────────────────────────────────────────────────────

function StationRow({
  station,
  operators,
  allStations,
  isExpanded,
  onToggle,
  onResolved,
}: {
  station: UnresolvedStation;
  operators: Operator[];
  allStations: AllStation[];
  isExpanded: boolean;
  onToggle: () => void;
  onResolved: () => void;
}) {
  const [mode, setMode] = useState<'create' | 'link'>('create');
  const [name, setName] = useState(station.suggestedName);
  const [nameEn, setNameEn] = useState(station.suggestedName);
  const [code, setCode] = useState('');
  const [operatorId, setOperatorId] = useState('');
  const [linkStationId, setLinkStationId] = useState('');
  const [stationFilter, setStationFilter] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const match = operators.find((o) =>
      o.odptOperatorId?.toLowerCase().includes(station.operatorKey.toLowerCase())
    );
    if (match) setOperatorId(match.id);
  }, [operators, station.operatorKey]);

  const filteredStations = stationFilter
    ? allStations.filter(
        (s) =>
          s.name.includes(stationFilter) ||
          s.code?.toLowerCase().includes(stationFilter.toLowerCase())
      )
    : allStations;

  async function handleSubmit() {
    setSubmitting(true);
    const body =
      mode === 'create'
        ? { action: 'create', odptStationId: station.odptStationId, name, nameEn, code, operatorId }
        : { action: 'link', odptStationId: station.odptStationId, stationId: linkStationId };

    const res = await fetch('/api/unresolved-connections/stations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      onResolved();
    } else {
      alert('保存に失敗しました');
    }
    setSubmitting(false);
  }

  const canSubmit =
    mode === 'create' ? name.trim() !== '' && operatorId !== '' : linkStationId !== '';

  return (
    <div className="border-b last:border-b-0">
      <div className="flex items-center px-4 py-3 gap-4">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-mono text-gray-600 truncate">{station.odptStationId}</div>
          <div className="text-xs text-gray-400 mt-0.5">
            {station.referencingStationNames.slice(0, 5).join('・')}
            {station.referencingStationNames.length > 5 &&
              ` 他${station.referencingStationNames.length - 5}駅`}
          </div>
        </div>
        <span className="text-xs text-gray-500 shrink-0">{station.referenceCount}件</span>
        <button
          onClick={onToggle}
          className="text-sm text-blue-600 hover:underline shrink-0"
        >
          {isExpanded ? '閉じる' : '解決'}
        </button>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 bg-blue-50 border-t">
          {/* Mode toggle */}
          <div className="flex gap-2 mt-3 mb-3">
            <button
              onClick={() => setMode('create')}
              className={`px-3 py-1 text-sm rounded ${mode === 'create' ? 'bg-blue-600 text-white' : 'border text-gray-600 hover:bg-gray-100'}`}
            >
              新規作成
            </button>
            <button
              onClick={() => setMode('link')}
              className={`px-3 py-1 text-sm rounded ${mode === 'link' ? 'bg-blue-600 text-white' : 'border text-gray-600 hover:bg-gray-100'}`}
            >
              既存駅に紐付け
            </button>
          </div>

          {mode === 'create' ? (
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">駅名 *</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="border rounded px-2 py-1.5 text-sm w-28"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">英語名</label>
                <input
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  className="border rounded px-2 py-1.5 text-sm w-28"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">駅コード</label>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="例: JC05"
                  className="border rounded px-2 py-1.5 text-sm w-20"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">事業者 *</label>
                <select
                  value={operatorId}
                  onChange={(e) => setOperatorId(e.target.value)}
                  className="border rounded px-2 py-1.5 text-sm"
                >
                  <option value="">選択</option>
                  {operators.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleSubmit}
                disabled={submitting || !canSubmit}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? '作成中...' : '駅を作成'}
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">駅を検索</label>
                <input
                  value={stationFilter}
                  onChange={(e) => setStationFilter(e.target.value)}
                  placeholder="駅名・コードで絞り込み"
                  className="border rounded px-2 py-1.5 text-sm w-44"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">紐付け先 *</label>
                <select
                  value={linkStationId}
                  onChange={(e) => setLinkStationId(e.target.value)}
                  className="border rounded px-2 py-1.5 text-sm w-56"
                >
                  <option value="">選択</option>
                  {filteredStations.slice(0, 100).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}{s.code ? ` (${s.code})` : ''}
                    </option>
                  ))}
                  {filteredStations.length > 100 && (
                    <option disabled>... 絞り込んでください ({filteredStations.length}件)</option>
                  )}
                </select>
              </div>
              <button
                onClick={handleSubmit}
                disabled={submitting || !canSubmit}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? '保存中...' : '紐付け'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ───── Page ────────────────────────────────────────────────────────────────

export default function UnresolvedConnectionsPage() {
  const [railways, setRailways] = useState<UnresolvedRailway[]>([]);
  const [stations, setStations] = useState<UnresolvedStation[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [allStations, setAllStations] = useState<AllStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRailwayId, setExpandedRailwayId] = useState<string | null>(null);
  const [expandedStationId, setExpandedStationId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/unresolved-connections').then((r) => r.json()),
      fetch('/api/operators').then((r) => r.json()),
      fetch('/api/stations').then((r) => r.json()),
    ]).then(([connectionsData, operatorsData, stationsData]) => {
      setRailways(connectionsData.railways);
      setStations(connectionsData.stations);
      setOperators(operatorsData);
      setAllStations(stationsData);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-4 text-sm text-gray-500">読み込み中...</div>;

  return (
    <div className="space-y-8 max-w-4xl">
      <h1 className="text-2xl font-bold">未解決の乗換接続</h1>
      <p className="text-sm text-gray-500 -mt-4">
        stationConnectionsテーブル内で、DBレコードに紐付けられていない路線・駅を登録します。
      </p>

      <OperatorSection
        operators={operators}
        onCreated={(op) => setOperators((prev) => [...prev, op])}
      />

      {/* Railways */}
      <section>
        <h2 className="text-lg font-semibold mb-3">
          未解決の路線
          <span className="text-gray-500 text-sm font-normal ml-2">({railways.length}件)</span>
        </h2>
        {railways.length === 0 ? (
          <p className="text-sm text-gray-400 italic">未解決の路線はありません</p>
        ) : (
          <div className="border rounded overflow-hidden bg-white">
            {railways.map((railway) => (
              <RailwayRow
                key={railway.odptRailwayId}
                railway={railway}
                operators={operators}
                isExpanded={expandedRailwayId === railway.odptRailwayId}
                onToggle={() =>
                  setExpandedRailwayId(
                    expandedRailwayId === railway.odptRailwayId ? null : railway.odptRailwayId
                  )
                }
                onResolved={() => {
                  setRailways((prev) => prev.filter((r) => r.odptRailwayId !== railway.odptRailwayId));
                  setExpandedRailwayId(null);
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* Stations */}
      <section>
        <h2 className="text-lg font-semibold mb-3">
          未解決の駅
          <span className="text-gray-500 text-sm font-normal ml-2">({stations.length}件)</span>
        </h2>
        {stations.length === 0 ? (
          <p className="text-sm text-gray-400 italic">未解決の駅はありません</p>
        ) : (
          <div className="border rounded overflow-hidden bg-white">
            {stations.map((station) => (
              <StationRow
                key={station.odptStationId}
                station={station}
                operators={operators}
                allStations={allStations}
                isExpanded={expandedStationId === station.odptStationId}
                onToggle={() =>
                  setExpandedStationId(
                    expandedStationId === station.odptStationId ? null : station.odptStationId
                  )
                }
                onResolved={() => {
                  setStations((prev) =>
                    prev.filter((s) => s.odptStationId !== station.odptStationId)
                  );
                  setExpandedStationId(null);
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
