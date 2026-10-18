'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { LineAccordion } from './LineAccordion';
import type { OperatorWithLines } from '@/types';

type Props = {
  operators: OperatorWithLines[];
};

export function OperatorList({ operators }: Props) {
  const [expandedOperator, setExpandedOperator] = useState<string | null>(
    operators.length === 1 ? (operators[0]?.id ?? null) : null
  );

  return (
    <div className="space-y-3">
      {operators.map((operator) => {
        const isOpen = expandedOperator === operator.id;
        return (
          <div
            key={operator.id}
            className="bg-surface rounded-card border border-line shadow-card overflow-hidden"
          >
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setExpandedOperator(isOpen ? null : operator.id)}
              className="w-full px-5 py-4 text-left flex justify-between items-center hover:bg-subtle transition-colors"
            >
              <span className="font-display font-bold text-base text-ink">
                {operator.name}
              </span>
              <ChevronDown
                size={20}
                className={`text-muted transition-transform duration-200 ${
                  isOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isOpen && (
              <div className="px-4 pb-3 border-t border-line">
                {operator.lines.length > 0 ? (
                  operator.lines.map((line) => (
                    <LineAccordion key={line.id} line={line} />
                  ))
                ) : (
                  <p className="text-muted text-sm py-3">路線がありません</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
