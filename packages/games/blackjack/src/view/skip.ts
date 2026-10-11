/**
 * Fast-forward for the table's event playback, with the UI kit's skip semantics: pending waits
 * resolve and later waits are instant until `reset()`. The caller finishes its running effects
 * (`finishAnimations`) in the same tick.
 */
export interface Skip {
  readonly skipped: boolean
  wait(ms: number): Promise<void>
  skip(): void
  reset(): void
}

export function createSkip(): Skip {
  let skipped = false
  const timers = new Set<() => void>()
  return {
    get skipped() {
      return skipped
    },
    wait(ms) {
      if (skipped || ms <= 0) return Promise.resolve()
      return new Promise<void>((resolve) => {
        const done = () => {
          clearTimeout(id)
          timers.delete(done)
          resolve()
        }
        const id = setTimeout(done, ms)
        timers.add(done)
      })
    },
    skip() {
      skipped = true
      for (const done of [...timers]) done()
    },
    reset() {
      skipped = false
    },
  }
}

type AnimationLike = Pick<Animation, 'finish' | 'cancel'>

/**
 * Jumps every scripted animation to its end, which also resolves `finished` so effects clean up
 * after themselves. CSS animations and transitions (card sway, badge blink) are left running:
 * the sway is infinite and can't finish.
 */
export function finishAnimations(animations: Iterable<AnimationLike>) {
  for (const a of animations) {
    if ('animationName' in a || 'transitionProperty' in a) continue
    try {
      a.finish()
    } catch {
      a.cancel()
    }
  }
}
