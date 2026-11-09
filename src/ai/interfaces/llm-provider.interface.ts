export const LLM_PROVIDER = Symbol('LLM_PROVIDER');

export interface LlmGenerateOptions {
  schema?: Record<string, unknown>;
  systemInstruction?: string;
  temperature?: number;
}

export interface LlmProvider {
  readonly name: string;
  isAvailable(): boolean;
  generate(prompt: string, schema?: Record<string, unknown>): Promise<string>;
}

