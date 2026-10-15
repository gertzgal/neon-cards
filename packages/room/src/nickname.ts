const LEFT = ['Neon', 'Pixel', 'Lucky', 'Quiet', 'Swift', 'Bold', 'Calm', 'Bright']
const RIGHT = ['Ace', 'Comet', 'Fox', 'Jade', 'Robin', 'Spark', 'Wren', 'Cedar']

export function randomNickname(byte: () => number): string {
  const left = LEFT[byte() % LEFT.length]
  const right = RIGHT[byte() % RIGHT.length]
  return `${left} ${right}`
}
