import { NextRequest, NextResponse } from 'next/server'

import {
  clearKnowledgeAdminCookie,
  setKnowledgeAdminCookie,
  verifyKnowledgePassword
} from '@/lib/knowledge-admin'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const password =
    body && typeof body.password === 'string' ? body.password.trim() : ''

  if (!verifyKnowledgePassword(password)) {
    return NextResponse.json({ error: '密码错误，请重试' }, { status: 401 })
  }

  const response = NextResponse.json({ success: true })
  setKnowledgeAdminCookie(response.cookies)
  return response
}

export async function DELETE() {
  const response = NextResponse.json({ success: true })
  clearKnowledgeAdminCookie(response.cookies)
  return response
}
