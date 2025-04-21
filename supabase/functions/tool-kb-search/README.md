
# Knowledge Base Search Tool

This Edge Function provides a read-only interface for searching knowledge base embeddings.

## Request Format
```json
{
  "query": "string",      // The search query text
  "company_id": "uuid",   // Company ID to scope the search
  "top_k": 5             // Optional: Number of results to return (default: 5)
}
```

## Response Format
```json
{
  "results": [
    {
      "id": "uuid",
      "title": "string",
      "content": "string",
      "url": "string",
      "similarity": 0.91
    }
  ]
}
```

The function generates embeddings for the query using OpenAI's text-embedding-3-small model and
performs similarity search against the knowledge base using cosine distance.
