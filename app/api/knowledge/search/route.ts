import { NextRequest, NextResponse } from 'next/server'

import {
  isKnowledgeAdminAuthorized,
  searchKnowledgeChunks
} from '@/lib/knowledge-admin'

function unauthorizedResponse() {
  return NextResponse.json(
    { error: '请先通过知识库管理密码验证' },
    { status: 401 }
  )
}

export async function GET(req: NextRequest) {
  if (!isKnowledgeAdminAuthorized(req.cookies)) {
    return unauthorizedResponse()
  }

  const query = req.nextUrl.searchParams.get('q') || ''

  try {
    const results = await searchKnowledgeChunks(query)
    return NextResponse.json({ results })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '搜索知识片段失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
