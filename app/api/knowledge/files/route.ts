import { NextRequest, NextResponse } from 'next/server'

import {
  deleteKnowledgeFiles,
  getKnowledgeFileSummaries,
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

  try {
    const files = await getKnowledgeFileSummaries()
    return NextResponse.json({ files })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '读取知识库列表失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  if (!isKnowledgeAdminAuthorized(req.cookies)) {
    return unauthorizedResponse()
  }

  const body = await req.json().catch(() => null)
  const targets =
    body && Array.isArray(body.targets)
      ? body.targets.filter(
          (target: unknown): target is { fileId?: string; filename: string } =>
            !!target &&
            typeof target === 'object' &&
            typeof (target as { filename?: unknown }).filename === 'string'
        )
      : []

  if (targets.length === 0) {
    return NextResponse.json(
      { error: '缺少待删除的知识文件目标' },
      { status: 400 }
    )
  }

  try {
    await deleteKnowledgeFiles(targets)
    return NextResponse.json({ success: true })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '删除知识文件失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
