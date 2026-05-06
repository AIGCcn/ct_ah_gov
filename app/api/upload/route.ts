import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File;
  const text = await file.text();

  // 简单分块（生产环境可用 LangChain）
  const chunks = text.match(/.{1,1000}/g) || [];

  for (const chunk of chunks) {
    const embeddingResponse = await fetch('https://api.minimaxi.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.Model_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'embo-01',
        input: chunk,
      }),
    });
    const { data } = await embeddingResponse.json();

    await supabase.from('documents').insert({
      content: chunk,
      embedding: data[0].embedding,
      metadata: { filename: file.name }
    });
  }

  return NextResponse.json({ success: true });
}
