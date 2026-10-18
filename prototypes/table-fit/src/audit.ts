import { MIN_ITEM, type Frame, type Viewport } from './place'

export type ClipEdge = 'left' | 'right' | 'top' | 'bottom'

export type AuditIssue =
  | { kind: 'clip'; id: string; edge: ClipEdge; value: number; limit: number }
  | { kind: 'overlap'; a: string; b: string }
  | { kind: 'floor'; id: string; w: number; h: number; min: number }

function intersects(a: Frame, b: Frame): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

/** Fail closed on a clip, an overlap, or an item under the global floor. HUD chrome is not an item. */
export function auditPlacement(viewport: Viewport, frames: readonly Frame[]): AuditIssue[] {
  const issues: AuditIssue[] = []
  const width = viewport.width
  const height = viewport.height

  for (const frame of frames) {
    if (frame.x < 0) issues.push({ kind: 'clip', id: frame.id, edge: 'left', value: frame.x, limit: 0 })
    if (frame.y < 0) issues.push({ kind: 'clip', id: frame.id, edge: 'top', value: frame.y, limit: 0 })
    const right = frame.x + frame.w
    const bottom = frame.y + frame.h
    if (right > width) issues.push({ kind: 'clip', id: frame.id, edge: 'right', value: right, limit: width })
    if (bottom > height) issues.push({ kind: 'clip', id: frame.id, edge: 'bottom', value: bottom, limit: height })
    if (frame.rowId !== 'hud' && (frame.w < MIN_ITEM || frame.h < MIN_ITEM)) {
      issues.push({ kind: 'floor', id: frame.id, w: frame.w, h: frame.h, min: MIN_ITEM })
    }
  }

  for (let i = 0; i < frames.length; i += 1) {
    const a = frames[i]
    if (!a) continue
    for (let j = i + 1; j < frames.length; j += 1) {
      const b = frames[j]
      if (!b) continue
      if (intersects(a, b)) issues.push({ kind: 'overlap', a: a.id, b: b.id })
    }
  }

  return issues
}
