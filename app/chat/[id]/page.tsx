import { type Metadata } from 'next'
import { redirect } from 'next/navigation'

import { auth } from '@/auth'
import { getChat } from '@/app/actions'
import { Chat } from '@/components/chat'

export const preferredRegion = 'home'

export interface ChatPageProps {
  params: {
    id: string
  }
}

export async function generateMetadata({
  params
}: ChatPageProps): Promise<Metadata> {
  const session = await auth()

  if (!session?.user) {
    return {}
  }

  try {
    const chat = await getChat(params.id)
    return {
      title: chat?.title.toString().slice(0, 50) ?? '对话'
    }
  } catch {
    return { title: '对话' }
  }
}

export default async function ChatPage({ params }: ChatPageProps) {
  const session = await auth()

  if (!session?.user) {
    redirect(`/sign-in?next=/chat/${params.id}`)
  }

  try {
    const chat = await getChat(params.id)

    if (!chat) {
      // 聊天记录可能还在写入中（saveChat 的 upsert 有短暂延迟），
      // 直接 notFound 会导致用户在首页新对话回答结束后跳转到 404。
      // 重定向回首页，让客户端 Chat 组件继续显示对话内容。
      redirect('/')
    }

    if (chat?.userId !== session?.user?.id) {
      // 用户无权访问此对话，重定向到首页
      redirect('/')
    }

    return <Chat id={chat.id} initialMessages={chat.messages} />
  } catch (error) {
    console.error('ChatPage error:', error)
    // 发生异常时重定向到首页，避免 404
    redirect('/')
  }
}
