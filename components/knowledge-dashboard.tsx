'use client'

import Link from 'next/link'
import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Eye,
  FileSearch,
  Loader2,
  Lock,
  RefreshCcw,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
  UserCog,
  Ban,
  CheckCircle,
  KeyRound
} from 'lucide-react'
import toast from 'react-hot-toast'

async function safeResponseJson<T = Record<string, unknown>>(
  response: Response
): Promise<T> {
  const text = await response.text()
  if (!text) {
    throw new Error(
      `服务器未返回有效响应（HTTP ${response.status}），请稍后重试`
    )
  }
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(
      `服务器返回了非预期响应（HTTP ${response.status}），请稍后重试`
    )
  }
}

import type {
  KnowledgeDeleteTarget,
  KnowledgeDuplicateStrategy,
  KnowledgeFileContent,
  KnowledgeFileSummary,
  KnowledgeSearchResult
} from '@/lib/knowledge-types'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

interface KnowledgeDashboardProps {
  initialAuthorized: boolean
  initialFiles: KnowledgeFileSummary[]
}

export function KnowledgeDashboard({
  initialAuthorized,
  initialFiles
}: KnowledgeDashboardProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [authorized, setAuthorized] = useState(initialAuthorized)
  const [password, setPassword] = useState('')
  const [files, setFiles] = useState(initialFiles)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [duplicateStrategy, setDuplicateStrategy] =
    useState<KnowledgeDuplicateStrategy>('replace')
  const [selectedFileKeys, setSelectedFileKeys] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<KnowledgeSearchResult[]>([])
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [deletingFileKeys, setDeletingFileKeys] = useState<string[]>([])
  const [previewFile, setPreviewFile] = useState<KnowledgeFileContent | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)

  // 用户管理状态
  const [activeTab, setActiveTab] = useState<'knowledge' | 'users'>('knowledge')
  const [users, setUsers] = useState<Array<{
    id: string; email: string; created_at: string;
    last_sign_in_at: string | null; banned: boolean;
    name: string; avatar_url: string
  }>>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [isUserActionLoading, setIsUserActionLoading] = useState<string | null>(null)
  const [tempPasswordResult, setTempPasswordResult] = useState<{ email: string; password: string } | null>(null)

  const stats = useMemo(() => {
    const totalFiles = files.length
    const totalChunks = files.reduce((sum, file) => sum + file.chunkCount, 0)
    const totalCharacters = files.reduce(
      (sum, file) => sum + file.characterCount,
      0
    )

    return {
      totalFiles,
      totalChunks,
      totalCharacters
    }
  }, [files])

  const selectedTargets = useMemo(() => {
    return files
      .filter(file => selectedFileKeys.includes(file.fileKey))
      .map<KnowledgeDeleteTarget>(file => ({
        fileId: file.fileId,
        filename: file.filename
      }))
  }, [files, selectedFileKeys])

  const duplicateFileCount = useMemo(() => {
    if (selectedFiles.length === 0) {
      return 0
    }

    const existingNames = new Set(files.map(file => file.filename))
    return selectedFiles.filter(file => existingNames.has(file.name)).length
  }, [files, selectedFiles])

  function formatDateTime(value: string) {
    if (!value) {
      return '历史数据'
    }

    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) {
      return value
    }

    return parsed.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  function formatBytes(bytes: number) {
    if (!bytes) {
      return '未知'
    }

    if (bytes < 1024) {
      return `${bytes} B`
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  function syncSelection(nextFiles: KnowledgeFileSummary[]) {
    setSelectedFileKeys(current =>
      current.filter(fileKey => nextFiles.some(file => file.fileKey === fileKey))
    )
  }

  async function refreshFiles(showToast = false) {
    setIsRefreshing(true)

    try {
      const response = await fetch('/api/knowledge/files', {
        method: 'GET',
        cache: 'no-store'
      })
      const payload = await safeResponseJson<{ files?: KnowledgeFileSummary[]; error?: string }>(response)

      if (!response.ok) {
        if (response.status === 401) {
          setAuthorized(false)
          setFiles([])
          setSelectedFileKeys([])
        }

        throw new Error(payload.error || '刷新知识库失败')
      }

      const nextFiles = payload.files || []
      setFiles(nextFiles)
      syncSelection(nextFiles)
      if (showToast) {
        toast.success('知识库列表已刷新')
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '刷新知识库失败'
      toast.error(message)
    } finally {
      setIsRefreshing(false)
    }
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!password.trim()) {
      toast.error('请输入管理密码')
      return
    }

    setIsSubmittingPassword(true)

    try {
      const response = await fetch('/api/knowledge/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password })
      })
      const payload = await safeResponseJson<{ success?: boolean; error?: string }>(response)

      if (!response.ok) {
        throw new Error(payload.error || '密码验证失败')
      }

      setAuthorized(true)
      setPassword('')
      await refreshFiles()
      router.refresh()
      toast.success('已进入知识库管理')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '密码验证失败'
      toast.error(message)
    } finally {
      setIsSubmittingPassword(false)
    }
  }

  async function handleLogout() {
    try {
      await fetch('/api/knowledge/auth', { method: 'DELETE' })
      setAuthorized(false)
      setFiles([])
      setSelectedFiles([])
      setSelectedFileKeys([])
      setSearchResults([])
      setPreviewFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      router.refresh()
      toast.success('已退出知识库管理')
    } catch {
      toast.error('退出失败，请稍后重试')
    }
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (selectedFiles.length === 0) {
      toast.error('请先选择要导入的文件')
      return
    }

    setIsUploading(true)

    try {
      for (const file of selectedFiles) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('duplicateStrategy', duplicateStrategy)

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        })

        const payload = await safeResponseJson<{ success?: boolean; error?: string; result?: unknown }>(response)

        if (!response.ok) {
          throw new Error(
            payload.error || `文件 ${file.name} 导入失败，请稍后重试`
          )
        }
      }

      const duplicateMessage =
        duplicateFileCount > 0
          ? `，其中 ${duplicateFileCount} 个同名文件按“${
              duplicateStrategy === 'replace' ? '覆盖旧文件' : '保留重复文件'
            }”策略处理`
          : ''

      toast.success(`已导入 ${selectedFiles.length} 个文件${duplicateMessage}`)
      setSelectedFiles([])
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      await refreshFiles()
      router.refresh()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '文件导入失败'
      toast.error(message)
    } finally {
      setIsUploading(false)
    }
  }

  async function runDelete(targets: KnowledgeDeleteTarget[], message: string) {
    if (!window.confirm(message)) {
      return
    }

    const deletingKeys = files
      .filter(file =>
        targets.some(
          target =>
            target.filename === file.filename &&
            (target.fileId ? target.fileId === file.fileId : !file.fileId)
        )
      )
      .map(file => file.fileKey)

    setDeletingFileKeys(deletingKeys)

    try {
      const response = await fetch('/api/knowledge/files', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ targets })
      })
      const payload = await safeResponseJson<{ success?: boolean; error?: string }>(response)

      if (!response.ok) {
        throw new Error(payload.error || '删除失败')
      }

      const deletedKeys = new Set(deletingKeys)
      const nextFiles = files.filter(file => !deletedKeys.has(file.fileKey))
      setFiles(nextFiles)
      syncSelection(nextFiles)
      toast.success('所选知识文件已删除')
      router.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : '删除失败'
      toast.error(message)
    } finally {
      setDeletingFileKeys([])
    }
  }

  async function handleDeleteSingle(file: KnowledgeFileSummary) {
    await runDelete(
      [{ fileId: file.fileId, filename: file.filename }],
      `确认删除“${file.filename}”及其全部知识分块吗？`
    )
  }

  async function handleDeleteBatch() {
    if (selectedTargets.length === 0) {
      toast.error('请先勾选需要删除的知识文件')
      return
    }

    await runDelete(
      selectedTargets,
      `确认批量删除已选中的 ${selectedTargets.length} 个知识文件吗？`
    )
  }

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!searchQuery.trim()) {
      setSearchResults([])
      toast.error('请输入要搜索的关键词')
      return
    }

    setIsSearching(true)

    try {
      const response = await fetch(
        `/api/knowledge/search?q=${encodeURIComponent(searchQuery.trim())}`,
        {
          method: 'GET',
          cache: 'no-store'
        }
      )
      const payload = await safeResponseJson<{ results?: KnowledgeSearchResult[]; error?: string }>(response)

      if (!response.ok) {
        throw new Error(payload.error || '搜索知识片段失败')
      }

      setSearchResults(payload.results || [])
      toast.success(`找到 ${(payload.results || []).length} 条相关知识片段`)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '搜索知识片段失败'
      toast.error(message)
    } finally {
      setIsSearching(false)
    }
  }

  async function handlePreview(target: KnowledgeDeleteTarget) {
    setPreviewOpen(true)
    setIsPreviewLoading(true)

    try {
      const params = new URLSearchParams()
      if (target.fileId) {
        params.set('fileId', target.fileId)
      } else {
        params.set('filename', target.filename)
      }

      const response = await fetch(`/api/knowledge/content?${params.toString()}`, {
        method: 'GET',
        cache: 'no-store'
      })
      const payload = await safeResponseJson<{ file?: KnowledgeFileContent; error?: string }>(response)

      if (!response.ok) {
        throw new Error(payload.error || '读取全文预览失败')
      }

      setPreviewFile(payload.file || null)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '读取全文预览失败'
      toast.error(message)
      setPreviewOpen(false)
    } finally {
      setIsPreviewLoading(false)
    }
  }

  function toggleFileSelection(fileKey: string) {
    setSelectedFileKeys(current =>
      current.includes(fileKey)
        ? current.filter(key => key !== fileKey)
        : [...current, fileKey]
    )
  }

  function toggleSelectAll(checked: boolean) {
    setSelectedFileKeys(checked ? files.map(file => file.fileKey) : [])
  }

  // ── 用户管理功能 ────────────────────────────────────────────
  async function loadUsers() {
    setIsLoadingUsers(true)
    try {
      const res = await fetch('/api/admin/users', { method: 'GET' })
      const data = await safeResponseJson<{ users?: any[]; error?: string }>(res)
      if (!res.ok) throw new Error(data.error || '获取用户列表失败')
      setUsers(data.users || [])
    } catch (err: any) {
      toast.error(err.message || '获取用户列表失败')
    } finally {
      setIsLoadingUsers(false)
    }
  }

  async function handleResetPassword(userId: string, email: string) {
    if (!window.confirm(`确认重置用户 ${email} 的密码？将生成临时密码。`)) return
    setIsUserActionLoading(userId)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'reset-password' })
      })
      const data = await safeResponseJson<{ success?: boolean; tempPassword?: string; error?: string }>(res)
      if (!res.ok) throw new Error(data.error || '重置密码失败')
      setTempPasswordResult({ email, password: data.tempPassword || '' })
      toast.success(`已为 ${email} 重置密码`)
    } catch (err: any) {
      toast.error(err.message || '重置密码失败')
    } finally {
      setIsUserActionLoading(null)
    }
  }

  async function handleToggleBan(userId: string, email: string, currentlyBanned: boolean) {
    const action = currentlyBanned ? 'unban' : 'ban'
    const msg = currentlyBanned
      ? `确认启用用户 ${email}？`
      : `确认禁用用户 ${email}？禁用后该用户将无法登录。`
    if (!window.confirm(msg)) return
    setIsUserActionLoading(userId)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action })
      })
      const data = await safeResponseJson<{ success?: boolean; error?: string }>(res)
      if (!res.ok) throw new Error(data.error || '操作失败')
      toast.success(currentlyBanned ? `已启用 ${email}` : `已禁用 ${email}`)
      await loadUsers()
    } catch (err: any) {
      toast.error(err.message || '操作失败')
    } finally {
      setIsUserActionLoading(null)
    }
  }

  if (!authorized) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center px-4 py-10">
        <div className="mb-4 w-full max-w-lg">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            返回首页
          </Link>
        </div>
        <Card className="mx-auto w-full max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              知识库管理验证
            </CardTitle>
            <CardDescription>
              请输入固定密码后再进行文档上传、知识文件查看与数据库清理。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleLogin}>
              <Input
                type="password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder="请输入管理密码"
                autoComplete="current-password"
              />
              <div className="rounded-lg border border-dashed border-border bg-muted/60 p-4 text-sm text-muted-foreground">
                当前管理页支持上传、搜索、全文预览、批量删除与重复文件策略管理。
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={isSubmittingPassword}
              >
                {isSubmittingPassword ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    验证中...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    进入管理页
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">管理后台</h2>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          返回首页
        </Link>
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-2 border-b border-border pb-0">
        <button
          onClick={() => { setActiveTab('knowledge'); }}
          className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'knowledge'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <FileSearch className="h-4 w-4" />
          知识库管理
        </button>
        <button
          onClick={() => { setActiveTab('users'); loadUsers(); }}
          className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'users'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Users className="h-4 w-4" />
          用户管理
        </button>
      </div>

      {/* 用户管理面板 */}
      {activeTab === 'users' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5" />
              注册账号管理
            </CardTitle>
            <CardDescription>
              查看所有注册用户，支持重置密码、禁用/启用账号。被禁用的账号登录时会收到提示。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={isLoadingUsers}
                onClick={loadUsers}
              >
                {isLoadingUsers ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />加载中...</>
                ) : (
                  <><RefreshCcw className="mr-2 h-4 w-4" />刷新列表</>
                )}
              </Button>
            </div>

            {/* 临时密码提示 */}
            {tempPasswordResult && (
              <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-sm">
                <div className="font-medium text-green-700 dark:text-green-400">
                  密码已重置成功
                </div>
                <div className="mt-1">
                  用户 <strong>{tempPasswordResult.email}</strong> 的临时密码：
                  <code className="ml-1 rounded bg-muted px-2 py-0.5 font-mono">{tempPasswordResult.password}</code>
                </div>
                <div className="mt-1 text-muted-foreground">
                  请将此密码发送给用户，用户登录后应尽快修改密码。
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() => setTempPasswordResult(null)}
                >
                  关闭
                </Button>
              </div>
            )}

            {isLoadingUsers ? (
              <div className="flex items-center text-sm text-muted-foreground py-8">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />正在加载用户列表...
              </div>
            ) : users.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/50 p-6 text-sm text-muted-foreground">
                暂无注册用户，或尚未加载用户列表。点击"刷新列表"获取。
              </div>
            ) : (
              <div className="space-y-3">
                {users.map(user => (
                  <div
                    key={user.id}
                    className={`rounded-xl border p-4 ${user.banned ? 'border-red-300 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20' : 'border-border/70 bg-background/70'}`}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-medium">
                            {user.name || user.email?.split('@')[0]}
                          </span>
                          {user.banned ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-400">
                              <Ban className="h-3 w-3" />已禁用
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-400">
                              <CheckCircle className="h-3 w-3" />正常
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                        <div className="text-xs text-muted-foreground">
                          注册时间 {formatDateTime(user.created_at)}
                          {user.last_sign_in_at && ` · 最近登录 ${formatDateTime(user.last_sign_in_at)}`}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isUserActionLoading === user.id}
                          onClick={() => handleResetPassword(user.id, user.email)}
                        >
                          {isUserActionLoading === user.id ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : (
                            <KeyRound className="mr-1 h-3 w-3" />
                          )}
                          重置密码
                        </Button>
                        <Button
                          type="button"
                          variant={user.banned ? 'default' : 'destructive'}
                          size="sm"
                          disabled={isUserActionLoading === user.id}
                          onClick={() => handleToggleBan(user.id, user.email, user.banned)}
                        >
                          {isUserActionLoading === user.id ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : user.banned ? (
                            <CheckCircle className="mr-1 h-3 w-3" />
                          ) : (
                            <Ban className="mr-1 h-3 w-3" />
                          )}
                          {user.banned ? '启用' : '禁用'}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 知识库管理面板 */}
      {activeTab === 'knowledge' && (
      <>
      <div className="grid gap-4 md:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <CardTitle>知识文件数</CardTitle>
            <CardDescription>按文件名聚合后的知识条目总数</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {stats.totalFiles}
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle>知识分块数</CardTitle>
            <CardDescription>当前数据库中已写入的文本分块总数</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {stats.totalChunks}
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle>总字符数</CardTitle>
            <CardDescription>用于估算知识体量的文本字符规模</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {stats.totalCharacters.toLocaleString('zh-CN')}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>上传入口</CardTitle>
            <CardDescription>
              支持文本、PDF、DOCX、DOC，上传后自动刷新列表并展示更详细的文件信息。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleUpload}>
              <Input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".txt,.md,.csv,.json,.html,.xml,.pdf,.docx,.doc"
                onChange={event =>
                  setSelectedFiles(Array.from(event.target.files || []))
                }
              />
              <div className="rounded-lg border border-border/70 bg-muted/40 p-3 text-sm">
                <div className="font-medium">重复文件处理策略</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={duplicateStrategy === 'replace' ? 'default' : 'outline'}
                    onClick={() => setDuplicateStrategy('replace')}
                  >
                    覆盖同名旧文件
                  </Button>
                  <Button
                    type="button"
                    variant={duplicateStrategy === 'keep' ? 'default' : 'outline'}
                    onClick={() => setDuplicateStrategy('keep')}
                  >
                    保留重复文件
                  </Button>
                </div>
                <div className="mt-2 text-muted-foreground">
                  已选 {selectedFiles.length} 个文件，检测到 {duplicateFileCount} 个同名文件。
                </div>
              </div>
              {selectedFiles.length > 0 ? (
                <div className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                  {selectedFiles.map(file => (
                    <div key={`${file.name}-${file.size}`}>
                      {file.name} · {formatBytes(file.size)}
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={isUploading}>
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      导入中...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      导入知识库
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isRefreshing}
                  onClick={() => refreshFiles(true)}
                >
                  {isRefreshing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      刷新中...
                    </>
                  ) : (
                    <>
                      <RefreshCcw className="mr-2 h-4 w-4" />
                      刷新列表
                    </>
                  )}
                </Button>
                <Button type="button" variant="ghost" onClick={handleLogout}>
                  退出管理
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>知识片段搜索</CardTitle>
            <CardDescription>
              按关键词搜索已入库的知识分块，并可直接打开该文件全文预览。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="flex gap-3" onSubmit={handleSearch}>
              <Input
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                placeholder="输入文件名、政策关键词或片段内容"
                className="flex-1"
              />
              <Button type="submit" disabled={isSearching} className="shrink-0 min-w-[80px]">
                {isSearching ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    搜索中...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    搜索
                  </>
                )}
              </Button>
            </form>
            {searchResults.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/50 p-4 text-sm text-muted-foreground">
                暂无搜索结果。输入关键词后可查看命中的知识片段。
              </div>
            ) : (
              <div className="space-y-3">
                {searchResults.map(result => (
                  <div
                    key={`${result.id}-${result.fileKey}`}
                    className="rounded-lg border border-border/70 bg-background/70 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="font-medium">{result.filename}</div>
                        <div className="text-xs text-muted-foreground">
                          分块 {result.chunkIndex} · 导入时间 {formatDateTime(result.importedAt)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {result.snippet}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          handlePreview({
                            fileId: result.fileId,
                            filename: result.filename
                          })
                        }
                      >
                        <FileSearch className="mr-2 h-4 w-4" />
                        预览全文
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>知识文件管理</CardTitle>
            <CardDescription>
              按导入记录查看已入库知识，支持详细信息展示、全文预览、单个或批量删除。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/70 bg-muted/40 p-3 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={files.length > 0 && selectedFileKeys.length === files.length}
                  onChange={event => toggleSelectAll(event.target.checked)}
                />
                全选
              </label>
              <div className="text-muted-foreground">
                已选 {selectedFileKeys.length} / {files.length} 个知识文件
              </div>
              <Button
                type="button"
                variant="destructive"
                disabled={selectedFileKeys.length === 0 || deletingFileKeys.length > 0}
                onClick={handleDeleteBatch}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                批量删除
              </Button>
            </div>
            {files.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/50 p-6 text-sm text-muted-foreground">
                暂无已导入的知识文件。完成上传后，列表会自动显示文件类型、导入时间、原始大小和内容预览。
              </div>
            ) : (
              files.map(file => (
                <div
                  key={file.fileKey}
                  className="rounded-xl border border-border/70 bg-background/70 p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={selectedFileKeys.includes(file.fileKey)}
                        onChange={() => toggleFileSelection(file.fileKey)}
                      />
                    <div className="space-y-2">
                      <div className="text-base font-medium">{file.filename}</div>
                      <div className="text-sm text-muted-foreground">
                        {file.chunkCount} 个分块，约{' '}
                        {file.characterCount.toLocaleString('zh-CN')} 个字符
                      </div>
                      <div className="text-sm text-muted-foreground">
                        类型 {file.sourceType} · 扩展名 .{file.extension} · 大小 {formatBytes(file.originalSize)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        MIME {file.mimeType} · 导入时间 {formatDateTime(file.importedAt)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        文件标识 {file.fileId || file.fileKey}
                      </div>
                      <div className="rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
                        {file.preview || '该文件暂无可展示的内容预览。'}
                      </div>
                    </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        handlePreview({ fileId: file.fileId, filename: file.filename })
                      }
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      预览全文
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={deletingFileKeys.includes(file.fileKey)}
                      onClick={() => handleDeleteSingle(file)}
                    >
                      {deletingFileKeys.includes(file.fileKey) ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          删除中...
                        </>
                      ) : (
                        <>
                          <Trash2 className="mr-2 h-4 w-4" />
                          删除文件
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
      <Dialog
        open={previewOpen}
        onOpenChange={open => {
          setPreviewOpen(open)
          if (!open) {
            setPreviewFile(null)
          }
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              {previewFile ? previewFile.filename : '知识文件全文预览'}
            </DialogTitle>
            <DialogDescription>
              {previewFile
                ? `${previewFile.sourceType} · ${previewFile.chunkCount} 个分块 · ${previewFile.characterCount.toLocaleString(
                    'zh-CN'
                  )} 个字符 · 导入时间 ${formatDateTime(previewFile.importedAt)}`
                : '正在加载全文内容'}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto rounded-lg border border-border/70 bg-muted/30 p-4">
            {isPreviewLoading ? (
              <div className="flex items-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                正在读取全文...
              </div>
            ) : (
              <pre className="whitespace-pre-wrap break-words text-sm leading-6">
                {previewFile?.text || '暂无可预览内容。'}
              </pre>
            )}
          </div>
        </DialogContent>
      </Dialog>
      </>
      )}
    </div>
  )
}
