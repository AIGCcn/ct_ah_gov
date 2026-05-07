import { NextRequest, NextResponse } from 'next/server'

import {
  getKnowledgeFileContent,
  isKnowledgeAdminAuthorized
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

  const fileId = req.nextUrl.searchParams.get('fileId') || undefined
  const filename = req.nextUrl.searchParams.get('filename') || ''

  if (!fileId && !filename.trim()) {
    return NextResponse.json(
      { error: '缺少需要预览的知识文件参数' },
      { status: 400 }
    )
  }

  try {
    const file = await getKnowledgeFileContent({
      fileId,
      filename
    })
    return NextResponse.json({ file })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '读取全文预览失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
