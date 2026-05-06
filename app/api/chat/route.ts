import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { createClient } from '@supabase/supabase-js';

const minimax = createOpenAI({ 
  apiKey: process.env.Model_API_KEY!,
  baseURL: 'https://api.minimaxi.com/v1' 
});
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  const { messages } = await req.json();
  const lastMessage = messages[messages.length - 1].content;

  // 1. 查询相似文档（RAG）
  let queryEmbedding = [];
  try {
    const embeddingResponse = await fetch('https://api.minimaxi.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.Model_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'embo-01',
        input: lastMessage,
      }),
    });
    const { data: embeddingData } = await embeddingResponse.json();
    queryEmbedding = embeddingData[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
  }

  const { data: docs } = await supabase.rpc('match_documents', {
    query_embedding: queryEmbedding.length > 0 ? queryEmbedding : new Array(1536).fill(0),
    match_threshold: 0.78,
    match_count: 5,
  });

  const context = docs?.map((d: any) => d.content).join('\n') || '';

  // 2. 流式返回
  const result = await streamText({
    model: minimax('abab6.5s-chat'),
    messages: [
      { role: 'system', content: `你是专业咨询智能体，只根据以下资料回答：\n${context}` },
      ...messages
    ],
  });

  return result.toTextStreamResponse();
}
