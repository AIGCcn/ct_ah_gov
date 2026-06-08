import React from 'react'

import { cn } from '@/lib/utils'
import { ExternalLink } from '@/components/external-link'

export function FooterText({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      className={cn(
        'px-2 text-center text-xs leading-normal text-muted-foreground',
        className
      )}
      {...props}
    >
      版权所有 © 安徽广电AIGC实验室 & 合肥生成式人工智能{' '}
      <ExternalLink href="https://github.com/AIGCcn/ct_ah_gov">GitHub</ExternalLink>
    </p>
  )
}
