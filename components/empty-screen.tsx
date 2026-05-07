import { UseChatHelpers } from 'ai/react'

import { Button } from '@/components/ui/button'
import { ExternalLink } from '@/components/external-link'
import { IconArrowRight } from '@/components/ui/icons'

const exampleMessages = [
  {
    heading: '广电和网络视听产业有哪些支持政策？',
    message: `《关于加快推进广播电视和网络视听产业高质量发展的实施意见》中提出了哪些重点支持方向和保障措施？`
  },
  {
    heading: '视听文旅融合三年行动计划的目标',
    message: '《视听文旅融合发展三年行动计划（2026-2028）》提出了哪些主要目标和重点任务？'
  },
  {
    heading: '文旅与广电如何深度融合？',
    message: '《文旅与广电深度融合双向赋能工作指引》中提出了哪些融合路径和赋能举措？'
  }
]

export function EmptyScreen({ setInput }: Pick<UseChatHelpers, 'setInput'>) {
  return (
    <div className="mx-auto max-w-2xl px-4">
      <div className="rounded-lg border bg-background p-8">
        <h1 className="mb-2 text-lg font-semibold">
          欢迎使用安徽广电文旅政策咨询智能体
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
