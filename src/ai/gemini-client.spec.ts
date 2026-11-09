import { ConfigService } from '@nestjs/config';
import { GeminiClient } from './gemini-client';

describe('GeminiClient', () => {
  let client: GeminiClient;
  let mockConfigService: jest.Mocked<ConfigService>;
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'ai.geminiApiKey') return 'test-gemini-key';
        if (key === 'ai.geminiModel') return 'gemini-1.5-flash';
        return undefined;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    client = new GeminiClient(mockConfigService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('fails soft when GEMINI_API_KEY is not configured', async () => {
    mockConfigService.get.mockReturnValueOnce(undefined);
    const unconfiguredClient = new GeminiClient(mockConfigService);

    expect(unconfiguredClient.isAvailable()).toBe(false);
    await expect(unconfiguredClient.generate('test prompt')).rejects.toThrow(
      'Gemini API is unavailable: GEMINI_API_KEY is not configured',
    );
  });

  it('is available when API key is provided', () => {
    expect(client.isAvailable()).toBe(true);
    expect(client.getModelName()).toBe('gemini-1.5-flash');
  });

  it('generates content and returns text on successful 200 response', async () => {
    const mockJson = {
      candidates: [
        {
          content: {
            parts: [{ text: '{"answer": "Marge nette saine à 25%", "figures": []}' }],
          },
        },
      ],
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(mockJson),
    });

    const response = await client.generate('Analyse ce snapshot');
    expect(response).toBe('{"answer": "Marge nette saine à 25%", "figures": []}');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('applies schema parameter to generationConfig', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        candidates: [{ content: { parts: [{ text: '{"status": "ok"}' }] } }],
      }),
    });

    const schema = {
      type: 'object',
      properties: { status: { type: 'string' } },
    };

    await client.generate('test prompt', schema);

    const callArgs = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(callArgs[1].body);

    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.responseSchema).toEqual(schema);
    expect(body.generationConfig.maxOutputTokens).toBe(8192);
    expect(body.generationConfig.thinkingConfig.thinkingBudget).toBe(0);
  });

  it('treats empty candidate text as an error that triggers fallback', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        candidates: [{ content: { parts: [{ text: '' }] } }],
      }),
    });

    await expect(client.generate('test empty')).rejects.toThrow(
      'Gemini API returned an empty response: IA indisponible',
    );
  });

  it('retries once on 429 status code with backoff', async () => {
    let callCount = 0;
    global.fetch = jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: false,
          status: 429,
          text: jest.fn().mockResolvedValue('Resource exhausted (rate limit)'),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          candidates: [{ content: { parts: [{ text: 'Success on retry' }] } }],
        }),
      });
    });

    const response = await client.generate('test with retry');
    expect(response).toBe('Success on retry');
    expect(callCount).toBe(2);
  });
});

