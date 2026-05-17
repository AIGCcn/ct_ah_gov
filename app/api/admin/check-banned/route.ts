import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

/** POST /api/admin/check-banned — 检查用户是否被禁用（公开接口，登录失败时调用） */
export async function POST(req: Request) {
  try {
    const { email } = await req.json()
    if (!email) {
      return Response.json({ error: '缺少邮箱' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin.auth.admin.listUsers()
    if (error) {
      return Response.json({ banned: false }, { status: 200 })
    }

    const user = (data.users || []).find(u => u.email === email)
    // ban_duration 字段在 admin API 返回但 TypeScript 类型中不存在
    const banDuration = (user as any)?.ban_duration
    if (user && banDuration && banDuration !== 'none') {
      return Response.json({ banned: true })
    }

    return Response.json({ banned: false })
  } catch {
    return Response.json({ banned: false }, { status: 200 })
  }
}
