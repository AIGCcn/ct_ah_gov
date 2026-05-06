import { UseChatHelpers } from 'ai/react'

import { Button } from '@/components/ui/button'
import { ExternalLink } from '@/components/external-link'
import { IconArrowRight } from '@/components/ui/icons'

const exampleMessages = [
  {
    heading: '咨询最新政策',
    message: `最近有哪些文旅支持政策？`
  },
  {
    heading: '了解申报条件',
    message: '我需要满足什么条件才能申请资金补助？'
  },
  {
    heading: '查询审批流程',
    message: `项目审批的完整流程是怎样的？`
  }
]

export function EmptyScreen({ setInput }: Pick<UseChatHelpers, 'setInput'>) {
  return (
    <div className="mx-auto max-w-2xl px-4">
      <div className="rounded-lg border bg-background p-8">
        <h1 className="mb-2 text-lg font-semibold">
          欢迎使用安徽广电文旅政咨询智能体
        </h1>
        <p className="mb-2 leading-normal text-muted-foreground">
          由安徽广电AIGC实验室与合肥生成式人工智能共同开发。
        </p>
        <p className="leading-normal text-muted-foreground">
          您可以在此进行对话，或尝试以下示例：
        </p>
        <div className="mt-4 flex flex-col items-start space-y-2">
          {exampleMessages.map((message, index) => (
            <Button
              key={index}
              variant="link"
              className="h-auto p-0 text-base"
              onClick={() => setInput(message.message)}
            >
              <IconArrowRight className="mr-2 text-muted-foreground" />
              {message.heading}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
