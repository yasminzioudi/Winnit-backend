import {
  Injectable,
  Inject,
  Logger,
  HttpException,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { LLM_PROVIDER, type LlmProvider } from './interfaces/llm-provider.interface';
import { FinancialSnapshotBuilder } from './financial-snapshot.builder';
import { AiCacheService } from './ai-cache.service';
import type { FinancialSnapshot } from './dto/financial-snapshot.dto';
import type { AskCfoDto, AskCfoResponse } from './dto/ask-cfo.dto';
import { validatePromptSafety } from './injection-guard';
import { verifyFigures } from './figure-verifier';
import { buildCompactSnapshot } from './compact-snapshot';
import { parseLlmJsonResponse } from './json-parser';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @Inject(LLM_PROVIDER)
    private readonly llmProvider: LlmProvider,
    private readonly snapshotBuilder: FinancialSnapshotBuilder,
    private readonly cacheService: AiCacheService,
  ) {}

  isAvailable(): boolean {
    return this.llmProvider.isAvailable();
  }

  async getFinancialSnapshot(
    workspaceId: string,
    from: string,
    to: string,
  ): Promise<FinancialSnapshot> {
    return this.snapshotBuilder.build(workspaceId, from, to);
  }

  /**
   * Generates an AI response for a prompt and snapshot with caching and throttling.
   */
  async generateWithSnapshot(
    workspaceId: string,
    prompt: string,
    snapshot: FinancialSnapshot,
    schema?: Record<string, unknown>,
  ): Promise<string> {
    // 1. Enforce rate limit (10 / min)
    this.cacheService.checkThrottle(workspaceId);

    // 2. Check 5-minute cache keyed by snapshot hash + prompt
    const snapshotHash = this.cacheService.hashSnapshot(snapshot);
    const cacheKey = this.cacheService.buildKey(workspaceId, snapshotHash, prompt);
    const cached = this.cacheService.get<string>(cacheKey);

    if (cached) {
      return cached;
    }

    // 3. Invoke LLM provider
    const result = await this.llmProvider.generate(prompt, schema);

    // 4. Cache response for 5 minutes
    this.cacheService.set(cacheKey, result);

    return result;
  }

  /**
   * Copilote CFO Q&A endpoint logic.
   * Answers questions based strictly on the FinancialSnapshot, strips hallucinated numbers,
   * rejects prompt injection attempts, and enforces rate limits.
   */
  async askCfo(workspaceId: string, dto: AskCfoDto): Promise<AskCfoResponse> {
    // 1. Availability check: Fail soft if AI provider is not available
    if (!this.isAvailable()) {
      throw new HttpException(
        'Copilote indisponible — vérifiez la configuration',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    // 2. Prompt injection safety guard
    validatePromptSafety(dto.question);

    // 3. Date range validation
    const fromDate = new Date(dto.from);
    const toDate = new Date(dto.to);
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new BadRequestException('Période invalide : format ISO requis.');
    }
    if (fromDate > toDate) {
      throw new BadRequestException('La date de début (from) doit précéder la date de fin (to).');
    }

    // 4. Build full anonymized FinancialSnapshot
    const snapshot = await this.snapshotBuilder.build(workspaceId, dto.from, dto.to);

    // Build compact representation for the LLM prompt to minimize latency
    const compactSnapshot = buildCompactSnapshot(snapshot);

    // 5. Construct CFO system instructions + prompt
    const systemPrompt = `Vous êtes le Copilote CFO virtuel de Winnit Profit OS, une plateforme financière pour e-commerçants COD (paiement à la livraison) en Tunisie.
Votre mission est d'éclairer le dirigeant sur ses finances, marges, coûts publicitaires, retours et encaissements COD.

RÈGLES STRICTES ET NON-NÉGOCIABLES:
1. Répondez exclusivement en français.
2. Basez-vous UNIQUEMENT et STRICTEMENT sur les données fournies dans le FinancialSnapshot ci-dessous.
3. Si une information n'est pas présente dans le snapshot, dites explicitement : "Je ne dispose pas de ces données dans le périmètre actuel".
4. Ne JAMAIS inventer, extrapoler ou halluciner de chiffres financiers. Tout chiffre cité DOIT figurer dans le snapshot.
5. Votre réponse doit être très concise et aller directement à l'essentiel (maximum 120 mots au total dans 'answer').
6. Vous DEVEZ renvoyer votre réponse au format JSON strict avec les clés:
- "answer": string (votre analyse claire, synthétique, max 120 mots)
- "citations": array de strings (sections du snapshot utilisées, ex: ["summary.waterfall", "topProducts"])
- "figures": array d'objets [{ "label": string, "value": number, "unit": string ("TND", "millimes", "%", "commandes", "jours"), "source": string }]

FINANCIAL SNAPSHOT (synthèse certifiée, compacte):
${JSON.stringify(compactSnapshot)}

QUESTION DU DIRIGEANT:
"${dto.question}"`;

    const schema = {
      type: 'object',
      properties: {
        answer: { type: 'string' },
        citations: {
          type: 'array',
          items: { type: 'string' },
        },
        figures: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              value: { type: 'number' },
              unit: {
                type: 'string',
                enum: ['TND', 'millimes', '%', 'commandes', 'jours', 'dt', 'score'],
              },
              source: { type: 'string' },
            },
            required: ['label', 'value'],
          },
        },
      },
      required: ['answer'],
    };

    // 6. Generate answer via LLM with caching and 10/min throttle
    let rawResult: string;
    try {
      rawResult = await this.generateWithSnapshot(workspaceId, systemPrompt, snapshot, schema);
      if (!rawResult || rawResult.trim().length === 0) {
        throw new HttpException(
          'Copilote indisponible — vérifiez la configuration',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
    } catch (err: unknown) {
      if (err instanceof HttpException) {
        throw err;
      }

      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`AI generation error: ${msg}`);

      // Timeout path: 504 Gateway Timeout
      if (
        (err instanceof Error && err.name === 'TimeoutError') ||
        msg.toLowerCase().includes('timed out') ||
        msg.toLowerCase().includes('timeout')
      ) {
        throw new HttpException(
          'Le Copilote met trop de temps, réessayez',
          HttpStatus.GATEWAY_TIMEOUT,
        );
      }

      // Configuration / Auth error: 503 Service Unavailable
      if (
        (err instanceof Error && err.name === 'ConfigurationError') ||
        msg.toLowerCase().includes('not configured') ||
        msg.toLowerCase().includes('configuration') ||
        msg.toLowerCase().includes('status 401') ||
        msg.toLowerCase().includes('status 403') ||
        msg.toLowerCase().includes('status 404')
      ) {
        throw new HttpException(
          'Copilote indisponible — vérifiez la configuration',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      // Default fallback
      throw new HttpException(
        'Copilote indisponible — vérifiez la configuration',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    // 7. Parse LLM response JSON safely (handles fences, thoughts, direct JSON)
    const parsed = parseLlmJsonResponse(rawResult);

    // 8. Server-side figure verification: zero hallucination policy against full snapshot
    const verification = verifyFigures(parsed.figures, snapshot, parsed.answer);

    return {
      answer: verification.adjustedAnswer,
      citations: parsed.citations,
      figures: verification.verifiedFigures,
      isVerified: verification.isVerified,
    };
  }
}
