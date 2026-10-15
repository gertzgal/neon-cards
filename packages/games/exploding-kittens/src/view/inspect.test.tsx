import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { scenes } from './art'
import { ekFace } from './face'

describe('press to read', () => {
  it('keeps the rule off the face', () => {
    const html = renderToStaticMarkup(<>{ekFace.render({ title: 'nope' }, { size: 'hand', widthPx: 160 })}</>)
    expect(html).toContain('NOPE')
    expect(html).not.toContain(scenes.nope.rule)
    expect(html).not.toContain('ek-face-rule')
  })
})
