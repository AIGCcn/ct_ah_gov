export type KnowledgeDuplicateStrategy = 'keep' | 'replace'

export interface KnowledgeFileSummary {
  fileKey: string
  fileId?: string
  filename: string
  extension: string
  mimeType: string
  sourceType: string
  chunkCount: number
  characterCount: number
  originalSize: number
  lastChunkId: number
  importedAt: string
  preview: string
}

export interface KnowledgeSearchResult {
  id: number
  fileKey: string
  fileId?: string
  filename: string
  importedAt: string
  chunkIndex: number
  snippet: string
}

export interface KnowledgeFileContent {
  fileKey: string
  fileId?: string
  filename: string
  extension: string
  mimeType: string
  sourceType: string
  importedAt: string
  chunkCount: number
  characterCount: number
  text: string
}

export interface KnowledgeDeleteTarget {
  fileId?: string
  filename: string
}

export interface KnowledgeIngestResult {
  fileKey: string
  fileId: string
  filename: string
  extension: string
  mimeType: string
  sourceType: string
  chunkCount: number
  characterCount: number
  originalSize: number
  importedAt: string
  duplicateStrategy: KnowledgeDuplicateStrategy
  replacedExisting: boolean
}
