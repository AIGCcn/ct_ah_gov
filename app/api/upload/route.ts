import { NextRequest, NextResponse } from 'next/server'

import {
  ingestKnowledgeFile,
  isKnowledgeAdminAuthorized,
  verifyKnowledgePassword
} from '@/lib/knowledge-admin'
import type { KnowledgeDuplicateStrategy } from '@/lib/knowledge-types'

export async function POST(req: NextRequest) {
  const headerPassword = req.headers.get('x-knowledge-password')
  const isAuthorized =
    isKnowledgeAdminAuthorized(req.cookies) ||
    (!!headerPassword && verifyKnowledgePassword(headerPassword))

  if (!isAuthorized) {
    return NextResponse.json(
      { error: '请先通过知识库管理密码验证' },
      { status: 401 }
    )
  }

  const formData = await req.formData()
  const file = formData.get('file')
  const duplicateStrategyValue = formData.get('duplicateStrategy')
  const duplicateStrategy: KnowledgeDuplicateStrategy =
    duplicateStrategyValue === 'replace' ? 'replace' : 'keep'

  // In Node.js 18, the global File constructor may not exist.
  // Use duck-typing to check if the form field is a file-like object.
  const isFileLike =
    file &&
    typeof file === 'object' &&
    'arrayBuffer' in file &&
    'text' in file &&
    'name' in file

  if (!isFileLike) {
    return NextResponse.json({ error: '请选择要上传的文件' }, { status: 400 })
  }

  try {
    const result = await ingestKnowledgeFile(file, duplicateStrategy)
    return NextResponse.json({ success: true, result })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '上传失败，请稍后重试'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
