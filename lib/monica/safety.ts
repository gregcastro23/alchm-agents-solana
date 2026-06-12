// Lightweight safety utilities for Monica

const INJECTION_PATTERNS = [
  /ignore (all|previous|prior) instructions/i,
  /you are (now|no longer) [^\.\n]+/i,
  /change your (role|identity|system)/i,
  /act as (system|developer)/i,
  /reset (system|persona)/i,
  /disregard (rules|constraints)/i,
]

const PII_PATTERNS = [
  // Emails, phones, SSN-like, addresses (very light heuristics)
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  /\+?\d{1,3}[\s-]?\(?\d{2,3}\)?[\s-]?\d{3}[\s-]?\d{4}/g,
  /\b\d{3}-\d{2}-\d{4}\b/g,
]

export function sanitizeUserInput(input: string, maxLen: number = 1000): string {
  let str = (input || '').toString()
  // hard cap length
  if (str.length > maxLen) str = str.slice(0, maxLen)
  // neutralize common injection phrases
  for (const pattern of INJECTION_PATTERNS) {
    str = str.replace(pattern, '[redacted-prompt-control]')
  }
  // remove odd control chars
  str = str.replace(/[\u0000-\u001F\u007F]+/g, ' ')
  return str
}

export function redactPII(input: string): string {
  let str = (input || '').toString()
  for (const pattern of PII_PATTERNS) {
    str = str.replace(pattern, '[redacted]')
  }
  return str
}

export function redactBirthInfo(obj: any): any {
  if (!obj) return obj
  const clone = { ...obj }
  if (clone.birthInfo) {
    clone.birthInfo = {
      hasDate: !!clone.birthInfo.date,
      hasTime: !!clone.birthInfo.time,
      hasPlace: !!clone.birthInfo.place || !!clone.birthInfo.location,
    }
  }
  return clone
}

export function clampTemperature(temp: number | undefined, def = 0.4): number {
  if (typeof temp !== 'number' || Number.isNaN(temp)) return def
  return Math.max(0, Math.min(1.5, temp))
}
