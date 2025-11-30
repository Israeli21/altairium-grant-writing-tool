-- Create the match_documents function for vector similarity search

CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(768),
  match_count int DEFAULT 5,
  filter_grant_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  content text,
  similarity float,
  uploaded_document_id uuid
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    document_embeddings.id,
    document_embeddings.content,
    1 - (document_embeddings.embedding <=> query_embedding) as similarity,
    document_embeddings.uploaded_document_id
  FROM document_embeddings
  WHERE document_embeddings.embedding IS NOT NULL
    AND (filter_grant_id IS NULL OR document_embeddings.grant_id = filter_grant_id)
  ORDER BY document_embeddings.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
