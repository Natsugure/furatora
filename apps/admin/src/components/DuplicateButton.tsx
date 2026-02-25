'use client';

import { useRouter } from 'next/navigation';

type Props = {
  trainId: string;
  trainName: string;
};

export function DuplicateButton({ trainId, trainName }: Props) {
  const router = useRouter();

  async function handleDuplicate() {
    const newName = prompt(`Duplicate "${trainName}" as:`, `${trainName} (Copy)`);
    if (!newName) return;

    // Fetch the original train data
    const res = await fetch(`/api/trains/${trainId}`);
    if (!res.ok) {
      alert('Failed to fetch train data');
      return;
    }

    const original = await res.json();

    // Create a duplicate with new name
    const createRes = await fetch('/api/trains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newName,
        operatorId: original.operators,
        lineIds: original.lines,
        carCount: original.carCount,
        carStructure: original.carStructure,
        freeSpaces: original.freeSpaces,
        prioritySeats: original.prioritySeats,
      }),
    });

    if (createRes.ok) {
      router.refresh();
    } else {
      alert('Failed to duplicate train');
    }
  }

  return (
    <button
      onClick={handleDuplicate}
      className="px-3 py-1.5 text-sm border rounded hover:bg-gray-100"
    >
      Duplicate
    </button>
  );
}
