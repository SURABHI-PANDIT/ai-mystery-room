const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

export class AiGenerationError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = 'AiGenerationError';
    this.code = code;
    this.diagnostic = options.diagnostic;
  }
}

function retryableProviderError(error) {
  const status = Number(error?.status || error?.statusCode || error?.response?.status);
  if (RETRYABLE_STATUS_CODES.has(status)) return true;
  return ['AbortError', 'TimeoutError', 'ECONNRESET', 'ETIMEDOUT'].includes(error?.name)
    || ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EAI_AGAIN'].includes(error?.code)
    || /timed? ?out|fetch failed|temporarily unavailable/i.test(error?.message || '');
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readHeader(error, name) {
  const sources = [error?.headers, error?.response?.headers];
  for (const headers of sources) {
    const value = headers?.get?.(name) ?? headers?.[name] ?? headers?.[name.toLowerCase()];
    if (value !== undefined && value !== null) return String(value);
  }
  return '';
}

function retryAvailableAt(error, message) {
  const retryAfter = readHeader(error, 'retry-after');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    const fromHeader = Number.isFinite(seconds)
      ? new Date(Date.now() + seconds * 1000)
      : new Date(retryAfter);
    if (Number.isFinite(fromHeader.getTime()) && fromHeader.getTime() > Date.now()) return fromHeader;
  }

  const match = message.match(/\b(?:retry|reset|available)\s+(?:in|after)\s+((?:\d+\s*[dhms]\s*)+)/i);
  if (!match) return undefined;
  const duration = [...match[1].matchAll(/(\d+)\s*([dhms])/gi)].reduce((total, [, amount, unit]) => {
    const multipliers = { d: 86_400_000, h: 3_600_000, m: 60_000, s: 1000 };
    return total + Number(amount) * multipliers[unit.toLowerCase()];
  }, 0);
  return duration > 0 ? new Date(Date.now() + duration) : undefined;
}

function providerFailureDetails(error) {
  const status = Number(error?.status || error?.statusCode || error?.response?.status) || undefined;
  const message = String(error?.message || 'Gemini request failed.');
  const timeout = /timeout|timed out|aborted/i.test(`${error?.name || ''} ${message}`);
  const retryAt = retryAvailableAt(error, message);
  const dailyQuotaExhausted = status === 429 && (
    /daily\s+(?:request\s+)?quota\s+(?:is\s+)?(?:exhausted|exceeded|reached)/i.test(message)
    || /(?:limit|quota)[^\n]{0,80}\bper\s+day\b/i.test(message)
    || /\bper\s+day\b[^\n]{0,80}(?:limit|quota)/i.test(message)
  );
  let code = 'GEMINI_REQUEST_FAILED';
  let safeMessage = 'Gemini could not generate this case right now.';

  if (dailyQuotaExhausted) {
    code = 'GEMINI_DAILY_QUOTA_EXHAUSTED';
    safeMessage = 'Gemini’s daily request quota is exhausted for this account.';
  } else if (status === 429) {
    code = 'GEMINI_RATE_LIMITED';
    safeMessage = retryAt
      ? 'Gemini temporarily rate limited this request.'
      : 'Gemini is temporarily rate limited.';
  } else if (status === 401 || status === 403) {
    code = 'GEMINI_AUTH_FAILED';
    safeMessage = 'Gemini rejected the server credentials or project permissions.';
  } else if (status === 404) {
    code = 'GEMINI_MODEL_UNAVAILABLE';
    safeMessage = 'The configured Gemini model is unavailable for this API key.';
  } else if (status === 503) {
    code = 'GEMINI_OVERLOADED';
    safeMessage = 'Gemini is experiencing high demand right now.';
  } else if (timeout) {
    code = 'GEMINI_TIMEOUT';
    safeMessage = 'Gemini did not respond before the request timed out.';
  }

  const key = process.env.GEMINI_API_KEY;
  const diagnostic = message
    .replaceAll(key || '\u0000', '[REDACTED]')
    .replace(/key=[^&\s]+/gi, 'key=[REDACTED]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
    .slice(0, 600);
  return { code, status, safeMessage, diagnostic, retryAvailableAt: retryAt };
}

function responseText(interaction) {
  if (typeof interaction?.output_text === 'string') return interaction.output_text;
  const step = [...(interaction?.steps || [])].reverse().find((item) => item.type === 'model_output');
  const part = step?.content?.find((item) => item.type === 'text');
  return typeof part?.text === 'string' ? part.text : '';
}

function parseJsonText(text) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned);
}

function validationMessage(error) {
  if (error instanceof SyntaxError) return 'Output must be valid JSON without surrounding text or markdown.';
  if (error?.issues) {
    return error.issues.slice(0, 8).map((issue) => `${issue.path.join('.') || 'output'}: ${issue.message}`).join('; ');
  }
  return error?.message || 'Output failed consistency checks.';
}

export async function generateStructuredOutput({
  ai,
  model,
  systemInstruction,
  promptBuilder,
  jsonSchema,
  zodSchema,
  semanticValidator,
  timeoutMs,
  maxAttempts = 2,
}) {
  const modelName = typeof model === 'string' ? model.trim() : '';
  if (!modelName) {
    throw new AiGenerationError('GEMINI_MODEL_NOT_CONFIGURED', 'A Gemini model must be configured for this request.');
  }

  let correction = '';
  let lastValidationError;
  const attemptLimit = Math.max(1, Math.min(3, Number(maxAttempts) || 2));

  for (let attempt = 1; attempt <= attemptLimit; attempt += 1) {
    let interaction;
    try {
      interaction = await ai.interactions.create({
        model: modelName,
        input: promptBuilder(correction),
        system_instruction: systemInstruction,
        ...(process.env.GEMINI_THINKING_LEVEL ? {
          generation_config: { thinking_level: process.env.GEMINI_THINKING_LEVEL },
        } : {}),
        response_format: { type: 'text', mime_type: 'application/json', schema: jsonSchema },
        store: false,
      }, {
        timeout_ms: timeoutMs,
        retries: { strategy: 'none' },
      });
    } catch (error) {
      const details = providerFailureDetails(error);
      const quotaExhausted = details.code === 'GEMINI_DAILY_QUOTA_EXHAUSTED';
      const hasProviderReset = details.retryAvailableAt instanceof Date;
      if (!quotaExhausted && !hasProviderReset && retryableProviderError(error) && attempt < attemptLimit) {
        const baseDelayMs = Math.max(250, Math.min(5000, Number(process.env.GEMINI_RETRY_DELAY_MS) || 1000));
        await wait(Math.min(8000, baseDelayMs * (2 ** (attempt - 1))));
        continue;
      }
      throw new AiGenerationError(
        error?.code === 'GEMINI_NOT_CONFIGURED' ? 'GEMINI_NOT_CONFIGURED' : details.code,
        error?.code === 'GEMINI_NOT_CONFIGURED'
          ? 'Gemini is not configured on the server.'
          : details.safeMessage,
        { cause: error, diagnostic: { ...details, diagnostic: error?.code === 'GEMINI_NOT_CONFIGURED' ? 'GEMINI_API_KEY is missing.' : details.diagnostic } },
      );
    }

    try {
      const parsed = zodSchema.parse(parseJsonText(responseText(interaction)));
      const validated = semanticValidator ? semanticValidator(parsed) : parsed;
      return validated;
    } catch (error) {
      lastValidationError = error;
      correction = validationMessage(error);
      if (attempt < attemptLimit) await wait(100 * attempt);
    }
  }

  throw new AiGenerationError(
    'INVALID_AI_OUTPUT',
    'Gemini returned case content that did not pass validation.',
    { cause: lastValidationError, diagnostic: { diagnostic: validationMessage(lastValidationError).slice(0, 600) } },
  );
}
