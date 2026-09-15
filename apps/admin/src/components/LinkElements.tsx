'use client';

import type { MouseEventHandler, ReactNode } from 'react';
import Link from 'next/link';
import {
  Button, type ButtonProps,
  ActionIcon, type ActionIconProps,
  Anchor, type AnchorProps
} from '@mantine/core';

type LinkButtonProps = ButtonProps & {
  href: string;
  children?: ReactNode;
  // 遷移前の未保存チェックなど、ナビゲーションを一旦横取りしたい呼び出し側向け。
  // component={Link} でレンダリングされるため実体は<a>。ButtonProps自体はスタイル
  // propsのみでDOMイベントを含まないため明示的に追加する
  onClick?: MouseEventHandler<HTMLAnchorElement>;
};

export function LinkButton({ href, children, ...props }: LinkButtonProps) {
  return (
    <Button component={Link} href={href} {...props}>
      {children}
    </Button>
  );
}

export function LinkIcon({ href, children, ...props}: ActionIconProps & { href: string; children?: ReactNode }) {
  return (
    <ActionIcon component={Link} href={href} {...props}>
      {children}
    </ActionIcon>
  );
}

export function LinkAnchor({ href, children, ...props }: AnchorProps & { href: string; children?: ReactNode }) {
  return (
    <Anchor renderRoot={(rootProps) => <Link href={href} {...rootProps} />} {...props}>
      {children}
    </Anchor>
  );
}

/** 詳細ページ上部の「〜に戻る」リンク。一覧ページ群で見た目を揃えるための薄いラッパ */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <LinkAnchor href={href} size="sm" mb="lg" style={{ display: 'block' }}>
      &larr; {children}
    </LinkAnchor>
  );
}
