import 'server-only'

import { createHash, randomUUID, timingSafeEqual } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import ws from 'ws'

import { extractKnowledgeText } from '@/lib/knowledge-parser'
import type {
  KnowledgeDeleteTarget,
  KnowledgeDuplicateStrategy,
  KnowledgeFileContent,
  KnowledgeFileSummary,
  KnowledgeIngestResult,
  KnowledgeSearchResult
} from '@/lib/knowledge-types'

const KNOWLEDGE_ADMIN_COOKIE = 'knowledge-admin-session'
const KNOWLEDGE_ADMIN_PASSWORD = 'c-chat-CXQ26'
const KNOWLEDGE_ADMIN_COOKIE_MAX_AGE = 60 * 60 * 12

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    realtime: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transport: ws as any
    }
  }
)

/** Admin client with service_role key — bypasses RLS for INSERT/DELETE */
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

type CookieReader = Pick<ReturnType<typeof cookies>, 'get'>
type CookieWriter = Pick<ReturnType<typeof cookies>, 'set'>

interface DocumentRow {
  id: number
  content: string | null
  metadata: Record<string, unknown> | null
}

function hashValue(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function safeEqual(left: string, right: string) {
  const leftHash = Buffer.from(hashValue(left))
  const rightHash = Buffer.from(hashValue(right))

  return timingSafeEqual(leftHash, rightHash)
}

function getKnowledgeCookieSecret() {
  return (
    process.env.KNOWLEDGE_ADMIN_SECRET ||
    process.env.Model_API_KEY ||
    KNOWLEDGE_ADMIN_PASSWORD
  )
}

function getKnowledgeCookieValue() {
  return hashValue(
    `${KNOWLEDGE_ADMIN_PASSWORD}:${getKnowledgeCookieSecret()}:knowledge-admin`
  )
}

function getMetadataRecord(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object') {
    return {}
  }

  return metadata as Record<string, unknown>
}

function getMetadataString(metadata: unknown, key: string) {
  const value = Reflect.get(getMetadataRecord(metadata), key)
  return typeof value === 'string' ? value.trim() : ''
}

function getMetadataNumber(metadata: unknown, key: string) {
  const value = Reflect.get(getMetadataRecord(metadata), key)
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function getFilename(metadata: unknown) {
  return getMetadataString(metadata, 'filename') || '未命名知识文件'
}

function getFileId(metadata: unknown) {
  return getMetadataString(metadata, 'fileId')
}

function getFileKey(metadata: unknown) {
  const fileId = getFileId(metadata)
  if (fileId) {
    return fileId
  }

  return `legacy:${getFilename(metadata)}`
}

function getImportedAt(metadata: unknown) {
  return getMetadataString(metadata, 'importedAt')
}

function getSourceType(metadata: unknown) {
  return getMetadataString(metadata, 'sourceType') || '文本文件'
}

function getMimeType(metadata: unknown) {
  return getMetadataString(metadata, 'mimeType') || 'text/plain'
}

function getExtension(metadata: unknown, filename: string) {
  const extension = getMetadataString(metadata, 'extension')
  if (extension) {
    return extension
  }

  const match = /\.([^.]+)$/.exec(filename)
  return match ? match[1].toLowerCase() : 'txt'
}

function getChunkIndex(metadata: unknown) {
  return getMetadataNumber(metadata, 'chunkIndex')
}

function toPreview(content: string) {
  const normalized = content.replace(/\s+/g, ' ').trim()
  return normalized.length > 120
    ? `${normalized.slice(0, 120).trim()}...`
    : normalized
}

function toSearchSnippet(content: string, query: string) {
  const normalized = content.replace(/\s+/g, ' ').trim()
  if (!normalized) {
    return '该分块暂无可展示内容。'
  }

  const lowerContent = normalized.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const matchIndex = lowerContent.indexOf(lowerQuery)

  if (matchIndex === -1) {
    return toPreview(normalized)
  }

  const start = Math.max(0, matchIndex - 40)
  const end = Math.min(normalized.length, matchIndex + query.length + 80)
  const snippet = normalized.slice(start, end).trim()

  return `${start > 0 ? '...' : ''}${snippet}${end < normalized.length ? '...' : ''}`
}

async function getDocumentRows() {
  const { data, error } = await supabase
    .from('documents')
    .select('id, content, metadata')
    .order('id', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as DocumentRow[]
}

async function getDocumentRowsForFile(target: KnowledgeDeleteTarget) {
  if (target.fileId?.trim()) {
    const { data, error } = await supabase
      .from('documents')
      .select('id, content, metadata')
      .filter('metadata->>fileId', 'eq', target.fileId.trim())
      .order('id', { ascending: true })

    if (error) {
      throw new Error(error.message)
    }

    return (data ?? []) as DocumentRow[]
  }

  const filename = target.filename.trim()
  const { data, error } = await supabase
    .from('documents')
    .select('id, content, metadata')
    .filter('metadata->>filename', 'eq', filename)
    .order('id', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as DocumentRow[]
}

async function deleteKnowledgeFilesByFilename(filename: string) {
  const { data, error } = await supabaseAdmin
    .from('documents')
    .delete()
    .filter('metadata->>filename', 'eq', filename.trim())
    .select('id')

  if (error) {
    throw new Error(error.message)
  }

  return data?.length ?? 0
}

export function verifyKnowledgePassword(password: string) {
  return safeEqual(password, KNOWLEDGE_ADMIN_PASSWORD)
}

export function isKnowledgeAdminAuthorized(cookieStore: CookieReader = cookies()) {
  const cookieValue = cookieStore.get(KNOWLEDGE_ADMIN_COOKIE)?.value
  if (!cookieValue) {
    return false
  }

  return safeEqual(cookieValue, getKnowledgeCookieValue())
}

export function setKnowledgeAdminCookie(cookieStore: CookieWriter = cookies()) {
  cookieStore.set(KNOWLEDGE_ADMIN_COOKIE, getKnowledgeCookieValue(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: KNOWLEDGE_ADMIN_COOKIE_MAX_AGE
  })
}

export function clearKnowledgeAdminCookie(cookieStore: CookieWriter = cookies()) {
  cookieStore.set(KNOWLEDGE_ADMIN_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0
  })
}

export async function getKnowledgeFileSummaries() {
  const data = await getDocumentRows()

  const fileMap = new Map<string, KnowledgeFileSummary>()

  for (const row of data) {
    const filename = getFilename(row.metadata)
    const fileId = getFileId(row.metadata) || undefined
    const fileKey = getFileKey(row.metadata)
    const content = typeof row.content === 'string' ? row.content : ''
    const existing = fileMap.get(fileKey)

    if (!existing) {
      fileMap.set(fileKey, {
        fileKey,
        fileId,
        filename,
        extension: getExtension(row.metadata, filename),
        mimeType: getMimeType(row.metadata),
        sourceType: getSourceType(row.metadata),
        chunkCount: 1,
        characterCount: content.length,
        originalSize: getMetadataNumber(row.metadata, 'originalSize'),
        lastChunkId: row.id,
        importedAt: getImportedAt(row.metadata),
        preview: toPreview(content)
      })
      continue
    }

    existing.chunkCount += 1
    existing.characterCount += content.length
    existing.lastChunkId = Math.max(existing.lastChunkId, row.id)
    if (!existing.originalSize) {
      existing.originalSize = getMetadataNumber(row.metadata, 'originalSize')
    }
    if (!existing.importedAt) {
      existing.importedAt = getImportedAt(row.metadata)
    }
    if (!existing.preview && content) {
      existing.preview = toPreview(content)
    }
  }

  return Array.from(fileMap.values()).sort(
    (left, right) => right.lastChunkId - left.lastChunkId
  )
}

export async function getKnowledgeFileContent(
  target: KnowledgeDeleteTarget
): Promise<KnowledgeFileContent> {
  const rows = await getDocumentRowsForFile(target)

  if (rows.length === 0) {
    throw new Error('未找到对应知识文件')
  }

  const firstRow = rows[0]
  const filename = getFilename(firstRow.metadata)

  return {
    fileKey: getFileKey(firstRow.metadata),
    fileId: getFileId(firstRow.metadata) || undefined,
    filename,
    extension: getExtension(firstRow.metadata, filename),
    mimeType: getMimeType(firstRow.metadata),
    sourceType: getSourceType(firstRow.metadata),
    importedAt: getImportedAt(firstRow.metadata),
    chunkCount: rows.length,
    characterCount: rows.reduce(
      (sum, row) => sum + (typeof row.content === 'string' ? row.content.length : 0),
      0
    ),
    text: rows.map(row => row.content || '').join('')
  }
}

export async function searchKnowledgeChunks(query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return [] as KnowledgeSearchResult[]
  }

  const rows = await getDocumentRows()

  return rows
    .filter(row => {
      const filename = getFilename(row.metadata).toLowerCase()
      const content = (row.content || '').toLowerCase()
      return filename.includes(normalizedQuery) || content.includes(normalizedQuery)
    })
    .slice(0, 50)
    .map(row => ({
      id: row.id,
      fileKey: getFileKey(row.metadata),
      fileId: getFileId(row.metadata) || undefined,
      filename: getFilename(row.metadata),
      importedAt: getImportedAt(row.metadata),
      chunkIndex: getChunkIndex(row.metadata) || 1,
      snippet: toSearchSnippet(row.content || '', query.trim())
    }))
}

export async function deleteKnowledgeFiles(targets: KnowledgeDeleteTarget[]) {
  if (targets.length === 0) {
    throw new Error('请选择至少一个知识文件')
  }

  for (const target of targets) {
    if (target.fileId?.trim()) {
      const { error } = await supabaseAdmin
        .from('documents')
        .delete()
        .filter('metadata->>fileId', 'eq', target.fileId.trim())

      if (error) {
        throw new Error(error.message)
      }
      continue
    }

    const filename = target.filename.trim()
    if (!filename) {
      throw new Error('文件名不能为空')
    }

    await deleteKnowledgeFilesByFilename(filename)
  }
}

/**
 * Generate embedding via Supabase Edge Function (gte-small, 384-dim)
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const response = await fetch(`${supabaseUrl}/functions/v1/embed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`
    },
    body: JSON.stringify({ input: text })
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(
      `向量生成请求失败（HTTP ${response.status}）${errorText ? `：${errorText}` : ''}`
    )
  }

  const data = await response.json()

  if (data.error) {
    throw new Error(`向量生成失败：${data.error}`)
  }

  if (!data.embedding || !Array.isArray(data.embedding)) {
    throw new Error('向量结果为空，请稍后重试')
  }

  return data.embedding
}

export async function ingestKnowledgeFile(
  file: File,
  duplicateStrategy: KnowledgeDuplicateStrategy = 'keep'
): Promise<KnowledgeIngestResult> {
  const extracted = await extractKnowledgeText(file)
  const text = extracted.text

  if (!text.trim()) {
    throw new Error('文件内容为空，无法导入知识库')
  }

  const chunks = text.match(/[\s\S]{1,1000}/g)?.filter(Boolean) ?? []
  if (chunks.length === 0) {
    throw new Error('文件无法被切分，请检查编码或内容格式')
  }

  let replacedExisting = false
  if (duplicateStrategy === 'replace') {
    replacedExisting = (await deleteKnowledgeFilesByFilename(file.name)) > 0
  }

  const fileId = randomUUID()
  const importedAt = new Date().toISOString()

  for (let index = 0; index < chunks.length; index++) {
    const chunk = chunks[index]
    const embedding = await generateEmbedding(chunk)

    const { error } = await supabaseAdmin.from('documents').insert({
      content: chunk,
      embedding,
      metadata: {
        fileId,
        filename: file.name,
        extension: extracted.extension,
        mimeType: extracted.mimeType,
        sourceType: extracted.sourceType,
        originalSize: extracted.originalSize,
        extractedCharCount: text.length,
        importedAt,
        chunkIndex: index + 1,
        chunkCount: chunks.length
      }
    })

    if (error) {
      throw new Error(error.message)
    }
  }

  return {
    fileKey: fileId,
    fileId,
    filename: file.name,
    extension: extracted.extension,
    mimeType: extracted.mimeType,
    sourceType: extracted.sourceType,
    chunkCount: chunks.length,
    characterCount: text.length,
    originalSize: extracted.originalSize,
    importedAt,
    duplicateStrategy,
    replacedExisting
  }
}
