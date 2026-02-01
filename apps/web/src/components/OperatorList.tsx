'use client';

import { useState } from 'react';
import { LineAccordion } from './LineAccordion';
import type { OperatorWithLines } from '@/types';

type Props = {
  operators: OperatorWithLines[];
};

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`w-5 h-5 transition-transform ${expanded ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 9l-7 7-7-7"
      />
    </svg>
  );
}

export function OperatorList({ operators }: Props) {
  const [expandedOperator, setExpandedOperator] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {operators.map((operator) => (
        <div
          key={operator.id}
          className="border border-gray-200 rounded-lg overflow-hidden"
        >
          <button
            onClick={() =>
              setExpandedOperator(
                expandedOperator === operator.id ? null : operator.id
              )
            }
            className="w-full p-4 text-left bg-gray-50 hover:bg-gray-100 flex justify-between items-center transition-colors"
          >
            <span className="font-semibold text-lg">{operator.name}</span>
            <ChevronIcon expanded={expandedOperator === operator.id} />
          </button>

          {expandedOperator === operator.id && (
            <div className="p-4 space-y-2 bg-white">
              {operator.lines.length > 0 ? (
                operator.lines.map((line) => (
                  <LineAccordion key={line.id} line={line} />
                ))
              ) : (
                <p className="text-gray-500 text-sm">路線がありません</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
