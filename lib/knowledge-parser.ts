import 'server-only'

import mammoth from 'mammoth'
import { PDFParse } from 'pdf-parse'
import WordExtractor from 'word-extractor'

interface ExtractedKnowledgeText {
  text: string
  extension: string
  mimeType: string
  sourceType: string
  originalSize: number
}

function normalizeExtractedText(text: string) {
  return text
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function getExtension(fileName: string) {
  const match = /\.([^.]+)$/.exec(fileName)
  return match ? match[1].toLowerCase() : 'txt'
}

function inferSourceType(extension: string) {
  switch (extension) {
    case 'pdf':
      return 'PDF 文档'
    case 'docx':
      return 'DOCX 文档'
    case 'doc':
      return 'DOC 文档'
    case 'md':
      return 'Markdown'
    case 'csv':
      return 'CSV 表格'
    case 'json':
      return 'JSON 数据'
    case 'html':
      return 'HTML 页面'
    case 'xml':
      return 'XML 文档'
    case 'txt':
    default:
      return '文本文件'
  }
}

async function extractPdfText(buffer: Buffer) {
  const parser = new PDFParse({ data: buffer })

  try {
    const result = await parser.getText()
    return result.text || ''
  } finally {
    await parser.destroy()
  }
}

async function extractDocxText(buffer: Buffer) {
  const result = await mammoth.extractRawText({ buffer })
  return result.value || ''
}

async function extractDocText(buffer: Buffer) {
  const extractor = new WordExtractor()
  const document = await extractor.extract(buffer)
  return document.getBody() || ''
}

export async function extractKnowledgeText(
  file: File
): Promise<ExtractedKnowledgeText> {
  const extension = getExtension(file.name)
  const mimeType = file.type || 'application/octet-stream'
  const originalSize = file.size
  const buffer = Buffer.from(await file.arrayBuffer())

  let text = ''

  if (extension === 'pdf') {
    text = await extractPdfText(buffer)
  } else if (extension === 'docx') {
    text = await extractDocxText(buffer)
  } else if (extension === 'doc') {
    text = await extractDocText(buffer)
  } else {
    text = await file.text()
  }

  return {
    text: normalizeExtractedText(text),
    extension,
    mimeType,
    sourceType: inferSourceType(extension),
    originalSize
  }
}
