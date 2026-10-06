// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { editor } from '../editor'

describe('shared editor', () => {
  afterEach(() => { document.body.replaceChildren() })
  it('renders untrusted markup and unsafe URLs as inert text', () => {
    const host = document.createElement('div'); document.body.append(host)
    const changed = vi.fn()
    const controller = editor.create(host, { value: '<script>alert(1)</script>\n[bad](javascript:alert(1))\n![bad](http://example.org/a.png)', onChange: changed })
    expect(host.querySelector('script, a, img')).toBeNull()
    expect(host.textContent).toContain('<script>alert(1)</script>')
    controller.setValue('## Heading\n[good](https://example.org/)\n![ok](https://example.org/a.png)')
    expect(host.querySelector('h2')?.textContent).toBe('Heading')
    expect(host.querySelector('a')?.getAttribute('rel')).toBe('noopener noreferrer')
    expect(host.querySelector('img')?.getAttribute('loading')).toBe('lazy')
    expect(changed).toHaveBeenCalled()
    controller.destroy()
    expect(host.childElementCount).toBe(0)
  })
  it('toggles bold for selected text and for subsequent typing', () => {
    const host = document.createElement('div'); document.body.append(host)
    const controller = editor.create(host, { value: 'hello world' })
    const input = host.querySelector('textarea')!
    const bold = [...host.querySelectorAll('button')].find(button => button.getAttribute('aria-label') === 'Bold')!
    input.setSelectionRange(6, 11)
    bold.click()
    expect(controller.getValue()).toBe('hello **world**')
    bold.click()
    expect(controller.getValue()).toBe('hello world')
    input.setSelectionRange(11, 11)
    bold.click()
    expect(controller.getValue()).toBe('hello world****')
    input.setRangeText('new', input.selectionStart, input.selectionEnd, 'end')
    input.dispatchEvent(new Event('input'))
    expect(controller.getValue()).toBe('hello world**new**')
    bold.click()
    expect(input.selectionStart).toBe(controller.getValue().length)
  })
  it('accepts pasted images only with explicit embedding or an upload callback', async () => {
    const host = document.createElement('div'); document.body.append(host)
    const uploadImage = vi.fn(async () => '../media/picture.png')
    const controller = editor.create(host, { uploadImage })
    const input = host.querySelector('textarea')!
    const file = new File(['bytes'], 'picture.png', { type: 'image/png' })
    const event = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', { value: { items: [{ type: file.type, getAsFile: () => file }] } })
    input.dispatchEvent(event)
    await vi.waitFor(() => expect(controller.getValue()).toBe('![picture.png](../media/picture.png)'))
    expect(host.querySelector('.hc-core-editor__preview img')).not.toBeNull()
    expect(uploadImage).toHaveBeenCalledOnce()
    expect(editor.render('![bad](data:image/svg+xml;base64,PHN2Zz4=)').querySelector('img')).toBeNull()
  })
  it('supports the page toolbar without executing inserted markup', () => {
    const host = document.createElement('div'); document.body.append(host)
    const controller = editor.create(host, { value: 'text', showPreview: false })
    const input = host.querySelector('textarea')!
    expect(host.querySelector('.hc-core-editor__preview')?.hasAttribute('hidden')).toBe(true)
    input.setSelectionRange(0, 4)
    host.querySelector<HTMLButtonElement>('[aria-label="Underline"]')!.click()
    expect(controller.getValue()).toBe('<u>text</u>')
    controller.setPreview(true)
    expect(host.querySelector('.hc-core-editor__preview u')?.textContent).toBe('text')
    host.querySelector<HTMLButtonElement>('[aria-label="Undo"]')!.click()
    expect(controller.getValue()).toBe('text')
    host.querySelector<HTMLButtonElement>('[aria-label="Redo"]')!.click()
    expect(controller.getValue()).toBe('<u>text</u>')
    controller.setReadOnly(true)
    controller.insertText('blocked')
    expect(controller.getValue()).toBe('<u>text</u>')
    controller.setValue('<u onclick="alert(1)">unsafe</u>')
    expect(host.querySelector('u')).toBeNull()
    controller.setPreview(true)
    expect(host.querySelector('.hc-core-editor__preview')?.hasAttribute('hidden')).toBe(false)
  })
  it('renders tables, tasks and code fences as inert DOM', () => {
    const fragment = editor.render('| A | B |\n| --- | --- |\n| 1 | 2 |\n- [x] done\n' + String.fromCharCode(96).repeat(3) + 'js\n<script>\n' + String.fromCharCode(96).repeat(3))
    expect(fragment.querySelectorAll('table tr')).toHaveLength(2)
    expect(fragment.querySelector('li input')?.getAttribute('type')).toBe('checkbox')
    expect(fragment.querySelector('pre code')?.textContent).toBe('<script>')
    expect(fragment.querySelector('script')).toBeNull()
  })
  it('shows a stored Wiki image beside the Markdown while editing', () => {
    const host = document.createElement('div'); document.body.append(host)
    const controller = editor.create(host, {
      value: '![Family](../media/page/photo%20one.png)', splitView: true,
      resolveImageUrl: url => url.startsWith('../media/')
        ? '/apps/hc_homewiki/api/pages/page/media/photo%20one.png' : url,
    })
    expect(host.querySelector('.hc-core-editor--split')).not.toBeNull()
    const input = host.querySelector('textarea')!
    expect(input.nextElementSibling?.classList.contains('hc-core-editor__preview')).toBe(true)
    expect(host.querySelector('img')?.getAttribute('src')).toContain('/api/pages/page/media/photo%20one.png')
    controller.setValue('![bad](javascript:alert(1))')
    expect(host.querySelector('img')).toBeNull()
  })
  it('formats a selection with italic, underline, a heading, color and font', () => {
    const host = document.createElement('div'); document.body.append(host)
    const controller = editor.create(host, { value: 'Test' })
    const input = host.querySelector('textarea')!
    const click = (name: string): void => {
      input.setSelectionRange(0, controller.getValue().length)
      host.querySelector<HTMLButtonElement>(`[aria-label="${name}"]`)!.click()
    }
    click('Italic'); expect(host.querySelector('.hc-core-editor__preview em')?.textContent).toBe('Test')
    controller.setValue('Test'); click('Underline'); expect(host.querySelector('.hc-core-editor__preview u')?.textContent).toBe('Test')
    controller.setValue('Test'); input.setSelectionRange(0, 4)
    const heading = host.querySelector<HTMLSelectElement>('[aria-label="Heading"]')!
    heading.value = '# '; heading.dispatchEvent(new Event('change'))
    expect(host.querySelector('.hc-core-editor__preview h1')?.textContent).toBe('Test')
    controller.setValue('Test'); input.setSelectionRange(0, 4)
    const color = host.querySelector<HTMLInputElement>('[aria-label="Text color"]')!
    color.value = '#bd1234'; color.dispatchEvent(new Event('change'))
    expect(host.querySelector<HTMLElement>('.hc-core-editor__preview span')?.style.color).toBe('rgb(189, 18, 52)')
    controller.setValue('Test'); input.setSelectionRange(0, 4)
    const font = host.querySelector<HTMLSelectElement>('[aria-label="Font"]')!
    font.value = 'Georgia'; font.dispatchEvent(new Event('change'))
    expect(host.querySelector<HTMLElement>('.hc-core-editor__preview span')?.style.fontFamily).toBe('Georgia')
  })
  it('opens a broad emoji catalog and inserts a chosen symbol', () => {
    const host = document.createElement('div'); document.body.append(host)
    const controller = editor.create(host)
    host.querySelector<HTMLButtonElement>('[aria-label="Emoji library"]')!.click()
    expect(host.querySelectorAll('.hc-core-editor__emoji-grid button').length).toBeGreaterThan(500)
    host.querySelector<HTMLButtonElement>('.hc-core-editor__emoji-grid button')!.click()
    expect(controller.getValue().length).toBeGreaterThan(0)
    expect(host.querySelector<HTMLElement>('.hc-core-editor__emoji-grid')!.parentElement!.hidden).toBe(true)
  })
  it('searches an image library and inserts the image with a source link', async () => {
    const host = document.createElement('div'); document.body.append(host)
    const controller = editor.create(host)
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ results: [{ title: 'Forest', url: 'https://images.example/forest.png', thumbnail: 'https://images.example/thumb.png', foreign_landing_url: 'https://example.org/photo', creator: 'Eva', license: 'CC BY' }] }) })))
    try {
      host.querySelector<HTMLButtonElement>('[aria-label="Free image libraries"]')!.click()
      host.querySelector<HTMLInputElement>('[placeholder="Search free images"]')!.value = 'forest'
      host.querySelector<HTMLButtonElement>('.hc-core-editor__picker button')!.click()
      await vi.waitFor(() => expect(host.querySelector('.hc-core-editor__image-result')).not.toBeNull())
      host.querySelector<HTMLButtonElement>('.hc-core-editor__image-result')!.click()
      expect(controller.getValue()).toContain('![Forest](https://images.example/forest.png)')
      expect(controller.getValue()).toContain('[Eva · CC BY](https://example.org/photo)')
      expect(host.querySelector('.hc-core-editor__preview img')).not.toBeNull()
    } finally { vi.unstubAllGlobals() }
  })
})

describe('shared Markdown rendering contract', () => {
  it('uses the same shared Markdown class in live preview and supports host decoration', () => {
    const host = document.createElement('div')
    const decoratePreview = (fragment: DocumentFragment) => {
      const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT)
      const nodes: Text[] = []
      while (walker.nextNode()) nodes.push(walker.currentNode as Text)
      for (const node of nodes) if (node.nodeValue?.includes('[[Page]]')) {
        const link = document.createElement('a'); link.className = 'wiki-link'; link.textContent = 'Page'
        node.replaceWith(link)
      }
    }
    const controller = editor.create(host, { value: '# Title\n\n[[Page]]', decoratePreview })
    expect(host.querySelector('.hc-core-editor__preview.hc-core-markdown h1')?.textContent).toBe('Title')
    expect(host.querySelector('.hc-core-editor__preview .wiki-link')?.textContent).toBe('Page')
    const rendered = editor.render('# Title\n\n[[Page]]')
    decoratePreview(rendered)
    expect(rendered.querySelector('h1')?.textContent).toBe('Title')
    expect(rendered.querySelector('.wiki-link')?.textContent).toBe('Page')
    controller.destroy()
  })
})
