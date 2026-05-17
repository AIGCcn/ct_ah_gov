import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { isKnowledgeAdminAuthorized } from '@/lib/knowledge-admin'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

/** GET /api/admin/users — 列出所有注册用户 */
export async function GET() {
  const cookieStore = cookies()
  if (!isKnowledgeAdminAuthorized(cookieStore)) {
    return Response.json({ error: '未授权' }, { status: 401 })
  }

  try {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers()
    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    const users = (data.users || []).map(user => ({
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      banned: !!((user as any).ban_duration && (user as any).ban_duration !== 'none'),
      name: user.user_metadata?.name || '',
      avatar_url: user.user_metadata?.avatar_url || ''
    }))

    return Response.json({ users })
  } catch (err: any) {
    return Response.json({ error: err.message || '获取用户列表失败' }, { status: 500 })
  }
}

/** PATCH /api/admin/users — 重置密码或禁用/启用账号 */
export async function PATCH(req: Request) {
  const cookieStore = cookies()
  if (!isKnowledgeAdminAuthorized(cookieStore)) {
    return Response.json({ error: '未授权' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { userId, action } = body as { userId: string; action: string }

    if (!userId || !action) {
      return Response.json({ error: '缺少参数' }, { status: 400 })
    }

    if (action === 'reset-password') {
      // 生成临时密码
      const tempPassword = 'Tmp' + Math.random().toString(36).slice(2, 10)
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: tempPassword
      })
      if (error) {
        return Response.json({ error: error.message }, { status: 500 })
      }
      return Response.json({ success: true, tempPassword })
    }

    if (action === 'ban') {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        ban_duration: '876000h' // ~100年，效果等同于永久禁用
      })
      if (error) {
        return Response.json({ error: error.message }, { status: 500 })
      }
      return Response.json({ success: true })
    }

    if (action === 'unban') {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        ban_duration: 'none'
      })
      if (error) {
        return Response.json({ error: error.message }, { status: 500 })
      }
      return Response.json({ success: true })
    }

    return Response.json({ error: '未知操作' }, { status: 400 })
  } catch (err: any) {
    return Response.json({ error: err.message || '操作失败' }, { status: 500 })
  }
}
