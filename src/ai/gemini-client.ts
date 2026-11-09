import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { LlmProvider } from './interfaces/llm-provider.interface';

export interface GeminiModelInfo {
  name: string;
  displayName: string;
  supportedGenerationMethods: string[];
}

@Injectable()
export class GeminiClient implements LlmProvider {
  readonly name = 'gemini';
  private readonly logger = new Logger(GeminiClient.name);
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly fallbackModel = 'gemini-3.1-flash-lite';

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('ai.geminiApiKey');
    this.model = this.configService.get<string>('ai.geminiModel') || 'gemini-1.5-flash';
    this.timeoutMs = this.configService.get<number>('ai.timeoutMs') || 30000;
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  getModelName(): string {
    return this.model;
  }

  /**
   * Generates content using Google Gemini API via Node native fetch.
   * Includes 30 s timeout and 1 retry on 429/5xx with backoff.
   * Never logs API key or raw prompts to protect privacy.
   */
  async generate(prompt: string, schema?: Record<string, unknown>): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('Gemini API is unavailable: GEMINI_API_KEY is not configured');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey!)}`;

    const generationConfig: Record<string, unknown> = {
      temperature: 0.2,
      maxOutputTokens: 8192,
      thinkingConfig: {
        thinkingBudget: 0,
      },
    };

    if (schema) {
      generationConfig.responseMimeType = 'application/json';
      generationConfig.responseSchema = schema;
    }

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig,
    };

    this.logger.log(`Prompt size: ${prompt.length} characters`);

    return this.executeWithRetry(url, requestBody);
  }

  /**
   * Queries Google Generative Language ListModels endpoint to verify the model.
   * Returns models that support 'generateContent'.
   */
  async listSupportedModels(): Promise<string[]> {
    if (!this.isAvailable()) {
      return [];
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(this.apiKey!)}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        this.logger.warn(`Failed to list Gemini models (HTTP ${response.status})`);
        return [];
      }

      const data = (await response.json()) as { models?: GeminiModelInfo[] };
      const supported = (data.models || [])
        .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m) => m.name.replace(/^models\//, ''));

      return supported;
    } catch (err) {
      this.logger.warn(
        `Error querying Gemini ListModels: ${err instanceof Error ? err.message : String(err)}`,
      );
      return [];
    }
  }

  private async executeWithRetry(
    url: string,
    body: Record<string, unknown>,
    attempt = 1,
  ): Promise<string> {
    const attemptTimeout =
      attempt === 1 ? Math.min(this.timeoutMs, 12000) : this.timeoutMs;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(attemptTimeout),
      });

      if (!response.ok) {
        const status = response.status;
        const errorText = await response.text().catch(() => 'unknown');

        // Retry once on rate limit (429) or transient server error (5xx)
        if ((status === 429 || status >= 500) && attempt === 1) {
          const backoffMs = status === 429 ? 1000 : 1000;
          this.logger.warn(
            `Gemini API transient failure (HTTP ${status}). Retrying in ${backoffMs}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          // If status is 503 (model overloaded) or 429 (rate/quota limit), switch to fast fallback model
          const nextUrl =
            (status === 503 || status === 429) && !url.includes(this.fallbackModel)
              ? url.replace(/models\/[^:]+:/, `models/${this.fallbackModel}:`)
              : url;
          return this.executeWithRetry(nextUrl, body, attempt + 1);
        }

        if (status === 401 || status === 403 || status === 404) {
          const configErr = new Error(
            `Gemini API configuration error (${status}): ${errorText.substring(0, 200)}`,
          );
          configErr.name = 'ConfigurationError';
          throw configErr;
        }

        throw new Error(
          `Gemini API request failed with status ${status}: ${errorText.substring(0, 200)}`,
        );
      }

      const result = (await response.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>;
          };
        }>;
        usageMetadata?: {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
          totalTokenCount?: number;
          thoughtsTokenCount?: number;
        };
      };

      if (result.usageMetadata) {
        this.logger.log(
          `usageMetadata: promptTokenCount=${result.usageMetadata.promptTokenCount}, thoughtsTokenCount=${result.usageMetadata.thoughtsTokenCount}, candidatesTokenCount=${result.usageMetadata.candidatesTokenCount}`,
        );
      }

      const candidate = result.candidates?.[0];
      const text = candidate?.content?.parts?.[0]?.text;

      if (!text || text.trim().length === 0) {
        throw new Error('Gemini API returned an empty response: IA indisponible');
      }

      return text;
    } catch (err) {
      if (
        err instanceof Error &&
        err.name === 'TimeoutError' &&
        attempt === 1 &&
        !url.includes(this.fallbackModel)
      ) {
        this.logger.warn('Gemini primary model timed out. Retrying with fallback model...');
        const nextUrl = url.replace(/models\/[^:]+:/, `models/${this.fallbackModel}:`);
        return this.executeWithRetry(nextUrl, body, attempt + 1);
      }

      if (err instanceof Error && err.name === 'TimeoutError') {
        const sec = Math.round(this.timeoutMs / 1000);
        const timeoutErr = new Error(`Gemini API call timed out after ${sec} s`);
        timeoutErr.name = 'TimeoutError';
        throw timeoutErr;
      }
      throw err;
    }
  }
}

