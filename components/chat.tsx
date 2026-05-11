'use client'

import { useChat, type Message } from 'ai/react'
import { useRouter } from 'next/navigation'

import { cn } from '@/lib/utils'
import { ChatList } from '@/components/chat-list'
import { ChatPanel } from '@/components/chat-panel'
import { EmptyScreen } from '@/components/empty-screen'
import { ChatScrollAnchor } from '@/components/chat-scroll-anchor'
import { useLocalStorage } from '@/lib/hooks/use-local-storage'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { useState } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { toast } from 'react-hot-toast'
import { saveChat } from '@/app/actions'

const IS_PREVIEW = process.env.VERCEL_ENV === 'preview'
export interface ChatProps extends React.ComponentProps<'div'> {
  initialMessages?: Message[]
  id?: string
}

export function Chat({ id, initialMessages, className }: ChatProps) {
  const router = useRouter()
  const [previewToken, setPreviewToken] = useLocalStorage<string | null>(
    'ai-token',
    null
  )
  const [previewTokenDialog, setPreviewTokenDialog] = useState(IS_PREVIEW)
  const [previewTokenInput, setPreviewTokenInput] = useState(previewToken ?? '')
  const [webSearchEnabled, setWebSearchEnabled] = useState(false)
  const { messages, append, reload, stop, isLoading, input, setInput } =
    useChat({
      initialMessages,
      id,
      body: {
        id,
        previewToken,
        webSearch: webSearchEnabled
      },
      onResponse(response) {
        if (response.status === 401) {
          toast.error(response.statusText)
        }
      },
      onFinish(message) {
        if (!id) return

        // 合并最终消息到 messages 数组
        const existingIndex = messages.findIndex(m => m.id === message.id)
        let allMessages: Message[]
        if (existingIndex >= 0) {
          allMessages = [...messages]
          allMessages[existingIndex] = message
        } else {
          allMessages = [...messages, message]
        }

        // 用第一条用户消息作为标题
        const userMsg = allMessages.find(m => m.role === 'user')
        const content =
          typeof userMsg?.content === 'string' ? userMsg.content : '新对话'
        const title = content.slice(0, 50)

        saveChat({ id, title, messages: allMessages }).then(() => {
          // 如果是首页新对话，跳转到 /chat/{id} 使 URL 持久化
          if (window.location.pathname === '/') {
            router.push(`/chat/${id}`)
          }
        })
      }
    })
  return (
    <>
      <div className={cn('pb-[220px] pt-4 md:pt-10', className)}>
        {messages.length ? (
          <>
            <ChatList messages={messages} />
            <ChatScrollAnchor trackVisibility={isLoading} />
          </>
        ) : (
          <EmptyScreen setInput={setInput} />
        )}
      </div>
      <ChatPanel
        id={id}
        isLoading={isLoading}
        stop={stop}
        append={append}
        reload={reload}
        messages={messages}
        input={input}
        setInput={setInput}
        webSearchEnabled={webSearchEnabled}
        setWebSearchEnabled={setWebSearchEnabled}
      />

      <Dialog open={previewTokenDialog} onOpenChange={setPreviewTokenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>输入 API 密钥</DialogTitle>
            <DialogDescription>
              如需使用预览环境，请输入您的 API 密钥。
              密钥将保存在浏览器的本地存储中，键名为{' '}
              <code className="font-mono">ai-token</code>。
            </DialogDescription>
          </DialogHeader>
          <Input
            value={previewTokenInput}
            placeholder="API 密钥"
            onChange={e => setPreviewTokenInput(e.target.value)}
          />
          <DialogFooter className="items-center">
            <Button
              onClick={() => {
                setPreviewToken(previewTokenInput)
                setPreviewTokenDialog(false)
              }}
            >
              保存密钥
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
