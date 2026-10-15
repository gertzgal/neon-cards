/** Crockford-style alphabet. No I, O, 0, or 1. */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function mintCode(byte: () => number): string {
  let code = ''
  for (let i = 0; i < 4; i++) {
    const index = byte() % CODE_ALPHABET.length
    code += CODE_ALPHABET[index]
  }
  return code
}

/** Returns the canonical code, or null when the string is not a room code. */
export function parseCode(input: string): string | null {
  if (input.length !== 4) return null
  const code = input.toUpperCase()
  for (const ch of code) if (!CODE_ALPHABET.includes(ch)) return null
  return code
}
