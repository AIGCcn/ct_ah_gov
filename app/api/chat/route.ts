import { createAnthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import { createClient } from '@supabase/supabase-js';

// MiniMax via Anthropic-compatible endpoint (Token Plan sk-cp- key)
const minimax = createAnthropic({
  apiKey: process.env.Model_API_KEY!,
  baseURL: 'https://api.minimaxi.com/anthropic/v1'
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

/**
 * Generate embedding via Supabase Edge Function (gte-small, 384-dim)
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const response = await fetch(`${supabaseUrl}/functions/v1/embed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({ input: text }),
  });

  if (!response.ok) {
    throw new Error(`Embedding request failed (HTTP ${response.status})`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(`Embedding failed: ${data.error}`);
  }
  if (!data.embedding || !Array.isArray(data.embedding)) {
    throw new Error('Empty embedding result');
  }

  return data.embedding;
}

// ── RAG 参数配置 ──────────────────────────────────────────────
const RAG_CONFIG = {
  /** 初始相似度阈值 */
  initialThreshold: 0.78,
  /** 阈值回退下限（自适应降级的最低阈值） */
  minThreshold: 0.5,
  /** 阈值回退步长 */
  thresholdStep: 0.05,
  /** 命中数不足时触发自适应回退的最小文档数 */
  minMatchCount: 2,
  /** 单次检索最大文档数 */
  maxMatchCount: 10,
  /** 单条文档最大字符数（超出截断） */
  maxChunkChars: 1500,
  /** context 总字符数上限（防止超出大模型上下文窗口） */
  maxContextChars: 6000,
};

/**
 * 自适应阈值检索：首次用高阈值检索，命中数不足时逐步降低阈值重试
 */
async function retrieveWithAdaptiveThreshold(
  embedding: number[],
  threshold: number,
  matchCount: number
): Promise<{ docs: any[]; finalThreshold: number }> {
  // 首次检索
  const { data: docs } = await supabase.rpc('match_documents', {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count: matchCount,
  });

  const results = docs || [];

  // 命中数充足，直接返回
  if (results.length >= RAG_CONFIG.minMatchCount) {
    return { docs: results, finalThreshold: threshold };
  }

  // 自适应回退：逐步降低阈值重试
  let currentThreshold = threshold - RAG_CONFIG.thresholdStep;
  while (currentThreshold >= RAG_CONFIG.minThreshold) {
    console.log(
      `[RAG 自适应] 命中 ${results.length} 条（阈值 ${threshold}），降低至 ${currentThreshold} 重试…`
    );

    const { data: retryDocs } = await supabase.rpc('match_documents', {
      query_embedding: embedding,
      match_threshold: currentThreshold,
      match_count: matchCount,
    });

    const retryResults = retryDocs || [];
    if (retryResults.length >= RAG_CONFIG.minMatchCount) {
      return { docs: retryResults, finalThreshold: currentThreshold };
    }

    currentThreshold -= RAG_CONFIG.thresholdStep;
  }

  // 降到最低阈值仍不足，返回最后一次结果（可能为空）
  console.log(
    `[RAG 自适应] 阈值已降至 ${RAG_CONFIG.minThreshold}，仍不足 ${RAG_CONFIG.minMatchCount} 条，使用现有结果`
  );
  return { docs: results, finalThreshold: threshold };
}

function getFilenameFromMetadata(metadata: unknown): string {
  if (!metadata || typeof metadata !== 'object') return '未知来源';
  const value = Reflect.get(metadata as Record<string, unknown>, 'filename');
  return typeof value === 'string' && value.trim() ? value.trim() : '未知来源';
}

/**
 * 上下文截断：单条文档限长 + 总 context 限长
 * 每条文档前标注来源政策文件名，便于AI引用具体政策
 */
function truncateContext(docs: any[]): string {
  const chunks: string[] = [];
  let totalChars = 0;

  for (const doc of docs) {
    const filename = getFilenameFromMetadata(doc.metadata);
    const sourceTag = `【来源：${filename}】\n`;
    // 单条截断（含来源标签）
    let content: string = doc.content || '';
    const maxContentChars = RAG_CONFIG.maxChunkChars - sourceTag.length;
    if (content.length > maxContentChars) {
      content = content.slice(0, Math.max(200, maxContentChars)) + '…[内容已截断]';
    }

    const taggedContent = sourceTag + content;

    // 总长度检查
    if (totalChars + taggedContent.length > RAG_CONFIG.maxContextChars) {
      // 还能放多少
      const remaining = RAG_CONFIG.maxContextChars - totalChars;
      if (remaining > 100) {
        chunks.push(taggedContent.slice(0, remaining) + '…[内容已截断]');
      }
      break;
    }

    chunks.push(taggedContent);
    totalChars += taggedContent.length;
  }

  return chunks.join('\n\n');
}

export async function POST(req: Request) {
  const { messages } = await req.json();
  const lastMessage = messages[messages.length - 1].content;

  // 1. 查询相似文档（RAG）via Supabase gte-small (384-dim)
  let queryEmbedding: number[] = [];
  try {
    queryEmbedding = await generateEmbedding(lastMessage);
  } catch (error) {
    console.error('Error generating embedding:', error);
  }

  // Fallback to zero vector (384-dim for gte-small)
  const embeddingToSearch = queryEmbedding.length > 0
    ? queryEmbedding
    : new Array(384).fill(0);

  // 2. 自适应阈值检索
  const { docs, finalThreshold } = await retrieveWithAdaptiveThreshold(
    embeddingToSearch,
    RAG_CONFIG.initialThreshold,
    RAG_CONFIG.maxMatchCount
  );

  console.log(
    `[RAG] 检索到 ${docs.length} 条文档（最终阈值 ${finalThreshold}）`
  );

  // 3. 上下文截断
  const context = truncateContext(docs);
  console.log(
    `[RAG] context 长度 ${context.length} 字符（上限 ${RAG_CONFIG.maxContextChars}）`
  );

  // 4. 流式返回 — MiniMax-M2.7 via Anthropic-compatible endpoint
  const result = await streamText({
    model: minimax('MiniMax-M2.7'),
    messages: [
      {
        role: 'system',
        content: `你是安徽省广电文旅政策咨询专业智能体，只根据以下资料回答。关键规则：
1. 回答时必须明确标注信息出自哪个具体的政策文件，使用"根据《xxx》/《xxx》的通知"的格式引用，绝不能笼统地说"根据政策汇编"或"根据资料"。
2. 如果参考资料来自多个政策文件，分别标注每个信息的来源文件名。
3. 如果资料中没有相关信息，请明确说明"根据现有资料无法回答"并给出注明AI生成的暧心建议，不要编造内容。

---参考资料开始---
${context}
---参考资料结束---`
      },
      ...messages
    ],
  });

  return result.toTextStreamResponse();
}
