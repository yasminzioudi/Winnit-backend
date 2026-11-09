import { BadRequestException } from '@nestjs/common';

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|above)\s+instructions/i,
  /system\s+prompt/i,
  /api[_\s-]?key/i,
  /cl[ée][_\s-]?api/i,
  /api[_\s-]?cl[ée]/i,
  /secret/i,
  /disregard\s+(all\s+)?instructions/i,
  /you\s+are\s+now/i,
  /jailbreak/i,
  /drop\s+table/i,
  /drop\s+database/i,
  /delete\s+from/i,
  /bypass\s+security/i,
];

/**
 * Validates prompt against known injection vectors, credential extraction, or system prompt leaks.
 */
export function validatePromptSafety(prompt: string): void {
  if (!prompt || typeof prompt !== 'string') {
    throw new BadRequestException('Question invalide.');
  }

  const clean = prompt.trim();
  if (clean.length < 3) {
    throw new BadRequestException('La question doit comporter au moins 3 caractères.');
  }

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(clean)) {
      throw new BadRequestException(
        'Question non autorisée ou tentative d\'injection de prompt détectée.',
      );
    }
  }
}

