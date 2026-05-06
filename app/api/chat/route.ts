import { createGroq } from '@ai-sdk/groq';
import { streamText } from 'ai';
import { createClient } from '@supabase/supabase-js';

const groq = createGroq({ apiKey: process.env.Model_API_KEY! }); // Use Model_API_KEY from .env
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
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
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
    model: groq('llama-3.3-70b-versatile'),
    messages: [
      { role: 'system', content: `你是专业咨询智能体，只根据以下资料回答：\n${context}` },
      ...messages
    ],
  });

  return result.toDataStreamResponse();
}
