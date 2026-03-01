'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { 
  Button, type ButtonProps,
  ActionIcon, type ActionIconProps, 
  Anchor, type AnchorProps 
} from '@mantine/core';

export function LinkButton({ href, children, ...props }: ButtonProps & { href: string; children?: ReactNode }) {
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
