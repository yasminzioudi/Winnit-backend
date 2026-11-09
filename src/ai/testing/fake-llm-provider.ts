import type { LlmProvider } from '../interfaces/llm-provider.interface';

export class FakeLlmProvider implements LlmProvider {
  readonly name = 'fake-llm';
  public available = true;
  public lastPrompt?: string;
  public lastSchema?: Record<string, unknown>;
  public mockResponse = '{"answer": "Analyse financière confirmée", "figures": []}';
  public callCount = 0;

  isAvailable(): boolean {
    return this.available;
  }

  setAvailable(available: boolean): void {
    this.available = available;
  }

  setMockResponse(response: string): void {
    this.mockResponse = response;
  }

  async generate(prompt: string, schema?: Record<string, unknown>): Promise<string> {
    this.callCount++;
    this.lastPrompt = prompt;
    this.lastSchema = schema;

    if (!this.available) {
      throw new Error('Fake LLM Provider is marked unavailable');
    }

    return this.mockResponse;
  }
}
