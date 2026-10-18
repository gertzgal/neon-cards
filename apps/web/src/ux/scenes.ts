/** Still frames for docs/multiplayer/ux.md. The lobby does not link here. */
export const scenes = [
  'ek-hands',
  'ek-favor',
  'ek-give',
  'ek-steal',
  'ek-attack',
  'ek-nope',
  'ek-explode',
  'ek-defuse',
  'ek-turn',
  'bj-table',
  'bj-bet',
  'bj-split',
] as const

export type SceneId = (typeof scenes)[number]

export function sceneFrom(search: string): SceneId {
  const asked = new URLSearchParams(search).get('scene')
  if (asked && (scenes as readonly string[]).includes(asked)) return asked as SceneId
  return 'ek-hands'
}
