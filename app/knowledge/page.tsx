import { cookies } from 'next/headers'

import { KnowledgeDashboard } from '@/components/knowledge-dashboard'
import {
  getKnowledgeFileSummaries,
  isKnowledgeAdminAuthorized
} from '@/lib/knowledge-admin'

export const metadata = {
  title: '知识库管理'
}

export default async function KnowledgePage() {
  const cookieStore = cookies()
  const authorized = isKnowledgeAdminAuthorized(cookieStore)
  const files = authorized ? await getKnowledgeFileSummaries() : []

  return (
    <KnowledgeDashboard initialAuthorized={authorized} initialFiles={files} />
  )
}
