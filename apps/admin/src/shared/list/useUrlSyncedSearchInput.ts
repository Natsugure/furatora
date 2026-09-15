'use client';

import { useRef, useState } from 'react';
import type { ChangeEvent, CompositionEvent } from 'react';
import { useDebouncedCallback } from '@mantine/hooks';

// 一覧の検索欄（Issue #94 の駅一覧・路線一覧ツールバー共通）。
// ADR-0009 のとおり URL クエリ（q）が唯一の状態源。ここで持つ useState は
// 「まだ URL に反映していない入力途中の値」だけ。
//
// 恒久的な制約（崩すと入力欄と URL が交互に巻き戻る）:
// - URL への反映は入力イベントからのみ行う（effect で q から派生させない）。
// - 入力欄への書き戻しは「自分が送っていない q」に限る（sentQ で判定）。
// - IME 変換中は URL を更新しない（iOS(WebKit) が変換を強制確定するため）。
export function useUrlSyncedSearchInput(
  q: string,
  commit: (next: string) => void,
  delay = 400,
) {
  const [value, setValue] = useState(q);
  const [prevQ, setPrevQ] = useState(q);
  const [sentQ, setSentQ] = useState(q); // 最後に commit した q。レンダー中に読むため ref ではなく state
  const composingRef = useRef(false);

  // props(q) の変化に応じて state を調整するパターン（effect を使わずレンダー中に setState）。
  // 戻る/進むなど自分の入力以外の経路で q が変わったときだけ入力欄に反映する。
  if (q !== prevQ) {
    setPrevQ(q);
    if (q !== sentQ) {
      setSentQ(q);
      setValue(q);
    }
  }

  const schedule = useDebouncedCallback((next: string) => {
    if (next === sentQ) return;
    setSentQ(next);
    commit(next);
  }, delay);

  return {
    value,
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      const next = e.currentTarget.value;
      setValue(next); // 制御された input の value は常に DOM の入力内容と一致させ続ける
      if (!composingRef.current) schedule(next);
    },
    onCompositionStart: () => {
      composingRef.current = true;
    },
    onCompositionEnd: (e: CompositionEvent<HTMLInputElement>) => {
      composingRef.current = false;
      const next = e.currentTarget.value;
      setValue(next);
      schedule(next);
    },
  };
}
