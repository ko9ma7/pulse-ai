export const API_VERSION = '2026-03-10';
export const MAX_CANDIDATES = 120;
export const OUTPUT_LIMIT = 60;
export const MIN_STARS = 20;

export const CATEGORY_QUERIES = [
  { category: 'Agent', terms: ['ai agent', 'agentic ai'] },
  { category: 'MCP', terms: ['mcp ai', 'model context protocol'] },
  { category: 'Coding', terms: ['vibe coding', 'ai coding agent'] },
  { category: 'LLM', terms: ['llm toolkit'] },
  { category: 'Local AI', terms: ['local ai', 'local llm'] },
  { category: 'RAG', terms: ['rag ai'] },
  { category: 'Computer Use', terms: ['computer use ai'] },
  { category: 'AI Image', terms: ['ai image generation'] },
  { category: 'AI Video', terms: ['ai video generation'] },
] as const;
