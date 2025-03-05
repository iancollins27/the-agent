
-- Match knowledge base embeddings by similarity
CREATE OR REPLACE FUNCTION match_knowledge_embeddings(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  company_id uuid
)
RETURNS TABLE (
  id uuid,
  content text,
  title text,
  url text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ke.id,
    ke.content,
    ke.title,
    ke.url,
    1 - (ke.embedding <=> query_embedding) as similarity
  FROM knowledge_base_embeddings ke
  WHERE ke.company_id = match_knowledge_embeddings.company_id
  AND 1 - (ke.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
