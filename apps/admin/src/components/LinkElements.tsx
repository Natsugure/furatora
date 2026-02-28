'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Button, type ButtonProps, Anchor, type AnchorProps } from '@mantine/core';

export function LinkButton({ href, children, ...props }: ButtonProps & { href: string; children?: ReactNode }) {
  return (
    <Button renderRoot={(rootProps) => <Link href={href} {...rootProps} />} {...props}>
      {children}
    </Button>
  );
}

export function LinkAnchor({ href, children, ...props }: AnchorProps & { href: string; children?: ReactNode }) {
  return (
    <Anchor renderRoot={(rootProps) => <Link href={href} {...rootProps} />} {...props}>
      {children}
    </Anchor>
  );
}
