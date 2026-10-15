import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TITLE_ORDER } from '../rules'
import { scenes } from './art'
import { ekFace } from './face'

describe('card rules', () => {
  it('keeps every rule to one sentence, off the face', () => {
    expect(scenes.skip.rule).toBe('End your turn without drawing a card.')
    for (const title of TITLE_ORDER) {
      const rule = scenes[title].rule
      expect(rule.endsWith('.')).toBe(true)
      expect(rule.slice(0, -1)).not.toContain('.')
      const html = renderToStaticMarkup(<>{ekFace.render({ title }, { size: 'hand', widthPx: 160 })}</>)
      expect(html).not.toContain(rule)
    }
  })
})
