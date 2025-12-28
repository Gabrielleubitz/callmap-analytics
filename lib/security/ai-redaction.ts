/**
 * AI Prompt Security - Secret Redaction and Injection Prevention
 * 
 * SECURITY: This module redacts sensitive information from prompts before sending to LLMs
 * and prevents prompt injection attacks.
 */

/**
 * Redact sensitive patterns from text before sending to LLM
 * 
 * SECURITY: Removes API keys, tokens, secrets, and other sensitive data
 */
export function redactSecrets(text: string): string {
  let redacted = text

  // Redact API keys (various formats)
  redacted = redacted.replace(/api[_-]?key["\s:=]+([a-zA-Z0-9_-]{20,})/gi, 'api_key=[REDACTED]')
  redacted = redacted.replace(/apikey["\s:=]+([a-zA-Z0-9_-]{20,})/gi, 'apikey=[REDACTED]')
  
  // Redact tokens
  redacted = redacted.replace(/token["\s:=]+([a-zA-Z0-9_-]{20,})/gi, 'token=[REDACTED]')
  redacted = redacted.replace(/auth[_-]?token["\s:=]+([a-zA-Z0-9_-]{20,})/gi, 'auth_token=[REDACTED]')
  redacted = redacted.replace(/bearer\s+([a-zA-Z0-9_-]{20,})/gi, 'bearer [REDACTED]')
  
  // Redact secrets
  redacted = redacted.replace(/secret["\s:=]+([a-zA-Z0-9_-]{20,})/gi, 'secret=[REDACTED]')
  redacted = redacted.replace(/password["\s:=]+([^\s"']+)/gi, 'password=[REDACTED]')
  
  // Redact Firebase project IDs and keys
  redacted = redacted.replace(/firebase[_-]?project[_-]?id["\s:=]+([a-zA-Z0-9_-]+)/gi, 'firebase_project_id=[REDACTED]')
  redacted = redacted.replace(/firebase[_-]?service[_-]?account["\s:=]+([^\s"']+)/gi, 'firebase_service_account=[REDACTED]')
  
  // Redact OpenAI keys
  redacted = redacted.replace(/sk-[a-zA-Z0-9]{32,}/g, 'sk-[REDACTED]')
  redacted = redacted.replace(/openai[_-]?api[_-]?key["\s:=]+([a-zA-Z0-9_-]{20,})/gi, 'openai_api_key=[REDACTED]')
  
  // Redact email addresses (optional - may want to keep for some use cases)
  // redacted = redacted.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL_REDACTED]')
  
  // Redact long hex strings (likely tokens/keys)
  redacted = redacted.replace(/\b[a-fA-F0-9]{32,}\b/g, '[HEX_TOKEN_REDACTED]')
  
  // Redact internal IDs that might be sensitive
  // Keep short IDs (likely user/workspace IDs) but redact very long ones
  redacted = redacted.replace(/\b[a-zA-Z0-9_-]{40,}\b/g, '[LONG_ID_REDACTED]')

  return redacted
}

/**
 * Sanitize user input to prevent prompt injection
 * 
 * SECURITY: Escapes special characters and removes dangerous patterns
 */
export function sanitizeUserInput(input: string): string {
  let sanitized = input

  // Remove or escape system prompt injection attempts
  const dangerousPatterns = [
    /ignore\s+(previous|all|above)\s+(instructions|prompts?)/gi,
    /you\s+are\s+now\s+(a|an)\s+/gi,
    /system:\s*/gi,
    /assistant:\s*/gi,
    /<\|system\|>/gi,
    /<\|assistant\|>/gi,
    /\[SYSTEM\]/gi,
    /\[ASSISTANT\]/gi,
  ]

  for (const pattern of dangerousPatterns) {
    sanitized = sanitized.replace(pattern, '[FILTERED]')
  }

  // Limit length to prevent resource exhaustion
  const MAX_INPUT_LENGTH = 10000
  if (sanitized.length > MAX_INPUT_LENGTH) {
    sanitized = sanitized.slice(0, MAX_INPUT_LENGTH) + '...[TRUNCATED]'
  }

  return sanitized
}

/**
 * Prepare user input for LLM with security measures
 * 
 * SECURITY: Combines redaction and sanitization
 */
export function preparePromptForLLM(userInput: string, systemContext?: string): {
  sanitizedInput: string
  sanitizedContext?: string
} {
  const sanitizedInput = sanitizeUserInput(userInput)
  const sanitizedContext = systemContext ? redactSecrets(sanitizeUserInput(systemContext)) : undefined

  return {
    sanitizedInput,
    sanitizedContext,
  }
}

/**
 * Check if input contains potential prompt injection
 * 
 * SECURITY: Returns true if suspicious patterns detected
 */
export function detectPromptInjection(input: string): boolean {
  const suspiciousPatterns = [
    /ignore\s+(previous|all|above)/i,
    /you\s+are\s+now/i,
    /system:\s*/i,
    /assistant:\s*/i,
    /forget\s+(everything|all|previous)/i,
    /new\s+(instructions|rules|prompt)/i,
    /override/i,
    /<\|system\|>/i,
    /<\|assistant\|>/i,
  ]

  return suspiciousPatterns.some(pattern => pattern.test(input))
}

