# Generation Endpoint Contract

## Summary
- **Route:** `POST /api/generate`
- **Purpose:** Produce one or more proposal sections for a specific grant using available context (retrieved embeddings or provided overrides).
- **Authentication:** Requires a signed-in user (enforced by upstream middleware/edge function).

## Request Body
- `grant_id` (string, UUID) — Required. Identifies which grant’s data and documents to use.
- `sections` (array of strings) — Optional. Each entry should match a supported section slug (e.g. `"executive_summary"`, `"needs_statement"`). Defaults to all supported sections when omitted.
- `overrides` (object) — Optional developer/testing hooks:
  - `context_chunks` (array of objects) — Manually supplied chunks when the retrieval pipeline is unavailable. Each chunk should provide:
    - `id` (string)
    - `content` (string)
    - `source_type` (string; e.g. `"uploaded"`, `"scraped"`)
    - `source_ref` (string; file name, URL, etc.)
  - Future override keys can be added without breaking the contract.

### Example Request
```json
{
  "grant_id": "8c3a3f1e-3ad0-4c36-94fd-82a2d2a1d5aa",
  "sections": ["executive_summary", "needs_statement"],
  "overrides": {
    "context_chunks": [
      {
        "id": "chunk-001",
        "content": "Altairium served 1,200 students through STEM workshops in 2024.",
        "source_type": "uploaded",
        "source_ref": "form-990-2024.pdf"
      }
    ]
  }
}
```

## Response Body
- `grant_id` (string) — Echo of the request.
- `sections` (array) — One entry per requested/processed section:
  - `name` (string)
  - `status` (string; `"success"`, `"skipped"`, or `"error"`)
  - `content` (string, nullable) — Generated text when status is `success`.
  - `tokens_used` (object, nullable) — `{ "prompt": number, "completion": number, "total": number }`.
  - `context_refs` (array) — IDs of chunks fed into the model.
  - `warnings` (array) — Developer-readable strings (e.g. "No context chunks available").
  - `error` (object, nullable) — `{ "message": string, "type": string }` when status is `error`.
- `meta` (object) — Request-level metadata:
  - `started_at` / `completed_at` (ISO timestamps)
  - `duration_ms` (number)
  - `warnings` (array)

### Example Response
```json
{
  "grant_id": "8c3a3f1e-3ad0-4c36-94fd-82a2d2a1d5aa",
  "sections": [
    {
      "name": "executive_summary",
      "status": "success",
      "content": "Altairium requests $150,000 to expand its STEM workshops ...",
      "tokens_used": { "prompt": 1234, "completion": 456, "total": 1690 },
      "context_refs": ["chunk-001", "chunk-014"],
      "warnings": [],
      "error": null
    },
    {
      "name": "needs_statement",
      "status": "error",
      "content": null,
      "tokens_used": null,
      "context_refs": [],
      "warnings": ["No context chunks available"],
      "error": {
        "message": "LLM provider timed out",
        "type": "LLMTimeout"
      }
    }
  ],
  "meta": {
    "started_at": "2025-11-09T20:15:33.120Z",
    "completed_at": "2025-11-09T20:15:36.784Z",
    "duration_ms": 3664,
    "warnings": []
  }
}
```

## Validation Rules
- Reject requests missing `grant_id` (HTTP 400).
- Reject when `sections` contains unsupported values (HTTP 400) and return the list of valid slugs.
- Accept an empty `sections` array by treating it as "none requested" (respond with `status: skipped`).
- Ignore unknown properties in `overrides` but surface a warning in `meta.warnings`.

## Error Handling
- Use HTTP 503 for upstream LLM outages.
- Use HTTP 500 for unexpected internal failures and include a trace ID (if available).
- Include section-level errors as shown above so the client can display granular feedback.

## Notes for Implementers
- All timestamps should be generated server-side (ISO 8601, UTC).
- `context_refs` must map back to rows in `document_embeddings` (or override chunks) so we can audit which documents influenced each section.
- Log every request with the resulting `meta` payload for observability.
- Add integration tests that assert the structure of this response when using mock context and mock LLM calls.
