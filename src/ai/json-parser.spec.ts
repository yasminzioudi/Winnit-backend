import { parseLlmJsonResponse } from './json-parser';

describe('JSON Parser (Fenced & Thought-Signature Responses)', () => {
  it('parses standard clean JSON payload', () => {
    const raw = JSON.stringify({
      answer: 'Rentabilité nette saine.',
      citations: ['summary.expenses'],
      figures: [{ label: 'Net Profit', value: 32000, unit: 'TND', source: 'expenses' }],
    });

    const parsed = parseLlmJsonResponse(raw);
    expect(parsed.answer).toBe('Rentabilité nette saine.');
    expect(parsed.citations).toEqual(['summary.expenses']);
    expect(parsed.figures).toHaveLength(1);
    expect(parsed.figures[0].value).toBe(32000);
  });

  it('parses markdown code-fenced JSON responses (```json ... ```)', () => {
    const raw = `
Voici l'analyse demandée :
\`\`\`json
{
  "answer": "Votre marge nette atteint 25.6%.",
  "citations": ["summary.waterfall"],
  "figures": [
    { "label": "Marge Nette", "value": 25.6, "unit": "%", "source": "expenses" }
  ]
}
\`\`\`
En espérant que cela vous éclaire.
`;

    const parsed = parseLlmJsonResponse(raw);
    expect(parsed.answer).toBe('Votre marge nette atteint 25.6%.');
    expect(parsed.citations).toEqual(['summary.waterfall']);
    expect(parsed.figures[0].value).toBe(25.6);
  });

  it('parses response with thought signatures or <thought> tags', () => {
    const raw = `
<thought>
Step 1: Check net margin from snapshot.
Step 2: Format figures in TND and %.
Step 3: Keep response under 120 words.
</thought>
\`\`\`json
{
  "answer": "Le net a baissé principalement en raison du taux de refus à Gafsa.",
  "citations": ["worstGovernorates"],
  "figures": [
    { "label": "Refus Gafsa", "value": 50, "unit": "%", "source": "worstGovernorates" }
  ]
}
\`\`\`
`;

    const parsed = parseLlmJsonResponse(raw);
    expect(parsed.answer).toBe(
      'Le net a baissé principalement en raison du taux de refus à Gafsa.',
    );
    expect(parsed.figures[0].value).toBe(50);
  });

  it('parses reasoning-prefixed thought text without tags', () => {
    const raw = `
Thinking Process:
- Analyzed 600 orders.
- Extracted net profit of 32,000 TND.

{
  "answer": "Résultat net positif de 32 000 TND.",
  "citations": ["summary.expenses"],
  "figures": [
    { "label": "Profit Net", "value": 32000, "unit": "TND" }
  ]
}
`;

    const parsed = parseLlmJsonResponse(raw);
    expect(parsed.answer).toBe('Résultat net positif de 32 000 TND.');
    expect(parsed.figures[0].value).toBe(32000);
  });
});

