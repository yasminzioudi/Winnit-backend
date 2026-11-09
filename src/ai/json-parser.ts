export interface ParsedLlmCfoResponse {
  answer: string;
  citations: string[];
  figures: Array<{
    label: string;
    value: number;
    unit?: string;
    source?: string;
  }>;
}

/**
 * Robust JSON extractor that handles:
 * 1. Markdown code fences (```json ... ``` or ``` ... ```)
 * 2. Thought signatures / Gemini thinking prefix text (e.g. <thought>...</thought> or Thinking Process: ...)
 * 3. Raw valid JSON strings.
 */
export function parseLlmJsonResponse(raw: string): ParsedLlmCfoResponse {
  if (!raw || typeof raw !== 'string') {
    throw new Error('Réponse LLM vide ou invalide');
  }

  let cleaned = raw.trim();

  // 1. Strip thought tags like <thought>...</thought> or <think>...</think>
  cleaned = cleaned.replace(/<(?:thought|think)>[\s\S]*?<\/(?:thought|think)>/gi, '').trim();

  // 2. Extract content from markdown code fences if present
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  // 3. Direct JSON parse attempt
  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    return normalizeCfoPayload(parsed);
  } catch {
    // 4. Fallback: extract the outermost JSON object { ... }
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const candidate = cleaned.substring(firstBrace, lastBrace + 1);
      try {
        const parsed = JSON.parse(candidate) as Record<string, unknown>;
        return normalizeCfoPayload(parsed);
      } catch {
        // Continue to text fallback
      }
    }
  }

  // If no JSON could be parsed at all, treat raw text as answer
  return {
    answer: raw.trim(),
    citations: [],
    figures: [],
  };
}

function normalizeCfoPayload(parsed: Record<string, unknown>): ParsedLlmCfoResponse {
  const answer = typeof parsed.answer === 'string' ? parsed.answer : String(parsed.answer || '');
  const citations = Array.isArray(parsed.citations)
    ? parsed.citations.map((c) => String(c))
    : [];

  const figures: ParsedLlmCfoResponse['figures'] = [];
  if (Array.isArray(parsed.figures)) {
    for (const item of parsed.figures) {
      if (item && typeof item === 'object') {
        const fig = item as Record<string, unknown>;
        const label = String(fig.label || '');
        const val = Number(fig.value);
        if (!isNaN(val)) {
          figures.push({
            label,
            value: val,
            unit: fig.unit ? String(fig.unit) : undefined,
            source: fig.source ? String(fig.source) : undefined,
          });
        }
      }
    }
  }

  return {
    answer,
    citations,
    figures,
  };
}

