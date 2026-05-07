-- Migrate from MiniMax embo-01 (1536-dim) to Supabase gte-small (384-dim)
-- Step 1: Drop the match_documents function (depends on embedding column type)
DROP FUNCTION IF EXISTS match_documents(vector(1536), float, int);

-- Step 2: Alter the embedding column from vector(1536) to vector(384)
ALTER TABLE documents ALTER COLUMN embedding TYPE vector(384) USING NULL;

-- Step 3: Recreate match_documents with 384-dim vectors
CREATE OR REPLACE FUNCTION match_documents (
  query_embedding vector(384),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) AS similarity
  FROM documents
  WHERE 1 - (documents.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;
