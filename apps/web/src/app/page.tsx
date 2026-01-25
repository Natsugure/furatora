'use client';

import { useState } from 'react';

type Station = {
  id: string;
  code: string | null;
  name: string;
  lat: string;
  lon: string;
  operator: string;
};

export default function Home() {
  const [query, setQuery] = useState('');
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/v1/stations?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      setStations(data.stations || []);
    } catch (error) {
      console.error('Search error:', error);
      alert('検索に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleStationClick = async (station: Station) => {
    setSelectedStation(station);
  };

  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">ベビーカー対応 乗換案内</h1>

      {/* 検索ボックス */}
      <div className="mb-8">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="駅名を入力（例：渋谷）"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300"
          >
            {loading ? '検索中...' : '検索'}
          </button>
        </div>
      </div>

      {/* 検索結果 */}
      {stations.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">検索結果</h2>
          <div className="space-y-2">
            {stations.map((station) => (
              <div
                key={station.id}
                onClick={() => handleStationClick(station)}
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold">{station.name}</h3>
                    <p className="text-sm text-gray-600">
                      {station.code} | {station.operator}
                    </p>
                  </div>
                  <div className="text-sm text-gray-500">
                    詳細を見る →
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 駅詳細 */}
      {selectedStation && (
        <div className="border border-gray-300 rounded-lg p-6 bg-white">
          <h2 className="text-2xl font-bold mb-4">{selectedStation.name}</h2>
          <div className="space-y-2 text-gray-700">
            <p><strong>駅コード:</strong> {selectedStation.code || '未設定'}</p>
            <p><strong>事業者:</strong> {selectedStation.operator}</p>
            <p><strong>緯度経度:</strong> {selectedStation.lat}, {selectedStation.lon}</p>
          </div>

          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-sm text-yellow-800">
              ℹ️ アクセシビリティ情報は今後追加予定です
            </p>
          </div>
        </div>
      )}

      {/* 初期状態のメッセージ */}
      {stations.length === 0 && !selectedStation && (
        <div className="text-center text-gray-500 py-12">
          駅名を入力して検索してください
        </div>
      )}
    </main>
  );
}