/** Shared Markdown editor. Storage and access rights belong to the host app. */
export interface EditorController {
  element: HTMLElement
  getValue(): string
  setValue(value: string): void
  focus(): void
  insertText(value: string): void
  setReadOnly(value: boolean): void
  setPreview(visible: boolean): void
  destroy(): void
}
export interface EditorOptions {
  value?: string
  label?: string
  onChange?: (markdown: string) => void
  onError?: (message: string) => void
  uploadImage?: (file: File) => Promise<string>
  embedImages?: boolean
  showPreview?: boolean
  splitView?: boolean
  resolveImageUrl?: (url: string) => string
  translate?: (label: string) => string
  /** Host-specific safe DOM decoration, e.g. wiki links. Core still owns Markdown parsing. */
  decoratePreview?: (fragment: DocumentFragment, markdown: string) => void
}
const DATA_IMAGE = /^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=]+$/i
const EMOJI_RANGES: Array<[string, number, number]> = [
  ['Faces', 0x1f600, 0x1f64f], ['People', 0x1f900, 0x1f9ff],
  ['Animals', 0x1f400, 0x1f43f], ['Food', 0x1f950, 0x1f96f],
  ['Activities', 0x1f3a0, 0x1f3ff], ['Travel', 0x1f680, 0x1f6ff],
  ['Nature and objects', 0x1f300, 0x1f5ff], ['More', 0x1fa00, 0x1faff],
  ['Symbols', 0x2300, 0x27bf],
]
const emojiCatalog = (): Array<{ category: string; symbol: string }> => {
  const result: Array<{ category: string; symbol: string }> = [], seen = new Set<string>()
  for (const [category, start, end] of EMOJI_RANGES) for (let point = start; point <= end; point++) {
    const symbol = String.fromCodePoint(point)
    if (/\p{Emoji_Presentation}/u.test(symbol) && !/\p{Emoji_Modifier}/u.test(symbol) && !seen.has(symbol)) {
      seen.add(symbol); result.push({ category, symbol })
    }
  }
  for (const code of ['CZ','SK','DE','AT','PL','GB','US','FR','IT','ES','UA','CA','AU','JP','CN','IN','BR','EU']) {
    const symbol = [...code].map(letter => String.fromCodePoint(letter.charCodeAt(0) - 65 + 0x1f1e6)).join('')
    result.push({ category: 'Flags', symbol })
  }
  return result
}
const safeMarkdownImageUrl = (value: string): string | null => {
  const url = safeUrl(value, true)
  return url ? url.replace(/\(/g, '%28').replace(/\)/g, '%29') : null
}
const safeUrl = (url: string, image = false): string | null => {
  if (image && url.length <= 1_400_000 && DATA_IMAGE.test(url)) return url
  try {
    const parsed = new URL(url, window.location.href)
    if (parsed.protocol === 'https:' || (!image && parsed.protocol === 'http:') ||
        (parsed.origin === window.location.origin && /^(?:\/{1}[^/]|\.\.?\/)/.test(url))) return parsed.href
  } catch { /* Invalid URLs stay plain text. */ }
  return null
}

/** Construct DOM nodes only; never inject Markdown as HTML. */
export const renderMarkdown = (markdown: string, resolveImageUrl?: (url: string) => string): DocumentFragment => {
  const fragment = document.createDocumentFragment()
  const inline = (container: HTMLElement, source: string): void => {
    const pattern = /(!?\[([^\]\n]{1,160})\]\(([^)\n]{1,1400000})\)|\*\*([^*\n]+)\*\*|~~([^~\n]+)~~|<u>([^<>\n]+)<\/u>|<mark>([^<>\n]+)<\/mark>|\*([^*\n]+)\*|\x60([^\x60\n]+)\x60|<span style="color:(#[0-9a-fA-F]{6})">([^<>\n]+)<\/span>|<span style="font-family:(system-ui|Arial|Verdana|Georgia|Times New Roman|Courier New)">([^<>\n]+)<\/span>)/g
    let offset = 0; let match: RegExpExecArray | null
    while ((match = pattern.exec(source)) !== null) {
      container.append(document.createTextNode(source.slice(offset, match.index)))
      if (match[2] !== undefined) {
        const image = match[1]?.startsWith('!') ?? false
        const resolved = image && resolveImageUrl ? resolveImageUrl(match[3]!) : match[3]!
        const url = safeUrl(resolved, image)
        if (url && image) {
          const element = document.createElement('img')
          element.src = url; element.alt = match[2]; element.setAttribute('loading', 'lazy'); container.append(element)
        } else if (url) {
          const element = document.createElement('a')
          element.href = url; element.rel = 'noopener noreferrer'; element.textContent = match[2]; container.append(element)
        } else container.append(document.createTextNode(match[0]))
      } else if (match[10] !== undefined || match[12] !== undefined) {
        const element = document.createElement('span')
        if (match[10] !== undefined) { element.style.color = match[10]; element.textContent = match[11] ?? '' }
        else { element.style.fontFamily = match[12]!; element.textContent = match[13] ?? '' }
        container.append(element)
      } else {
        const tag = match[4] !== undefined ? 'strong' : match[5] !== undefined ? 'del'
          : match[6] !== undefined ? 'u' : match[7] !== undefined ? 'mark' : match[9] !== undefined ? 'code' : 'em'
        const element = document.createElement(tag)
        element.textContent = match[4] ?? match[5] ?? match[6] ?? match[7] ?? match[8] ?? match[9] ?? ''
        container.append(element)
      }
      offset = pattern.lastIndex
    }
    container.append(document.createTextNode(source.slice(offset)))
  }
  const lines = String(markdown).replace(/\r\n?/g, '\n').split('\n')
  let list: HTMLUListElement | HTMLOListElement | null = null
  const fence = String.fromCharCode(96).repeat(3)
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!
    if (line.startsWith(fence)) {
      const language = line.slice(3).trim().replace(/[^\w+-]/g, '')
      const code: string[] = []
      while (++index < lines.length && !lines[index]!.startsWith(fence)) code.push(lines[index]!)
      const pre = document.createElement('pre'), element = document.createElement('code')
      if (language) element.className = 'language-' + language
      element.textContent = code.join('\n'); pre.append(element); fragment.append(pre); list = null; continue
    }
    if (/^\s*\|/.test(line) && /^\s*\|?\s*:?-{3,}/.test(lines[index + 1] ?? '')) {
      const table = document.createElement('table')
      const row = (text: string, heading: boolean): void => {
        const tr = document.createElement('tr')
        text.replace(/^\s*\|?|\|?\s*$/g, '').split('|').forEach(cell => {
          const element = document.createElement(heading ? 'th' : 'td'); inline(element, cell.trim()); tr.append(element)
        }); table.append(tr)
      }
      row(line, true); index++
      while (index + 1 < lines.length && /^\s*\|/.test(lines[index + 1]!)) row(lines[++index]!, false)
      fragment.append(table); list = null; continue
    }
    if (/^\s*(?:[-*] |\d+\. )/.test(line)) {
      const ordered = /^\s*\d+\. /.test(line)
      if (!list || list.tagName !== (ordered ? 'OL' : 'UL')) {
        list = document.createElement(ordered ? 'ol' : 'ul'); fragment.append(list)
      }
      const item = document.createElement('li')
      const body = line.replace(/^\s*(?:[-*] |\d+\. )/, '')
      const task = /^\[([ xX])\] /.exec(body)
      if (task) {
        const box = document.createElement('input'); box.type = 'checkbox'; box.disabled = true
        box.checked = task[1]!.toLowerCase() === 'x'; item.append(box); inline(item, body.slice(4))
      } else inline(item, body)
      list.append(item); continue
    }
    list = null
    if (/^\s*(?:---+|\*\*\*+)\s*$/.test(line)) { fragment.append(document.createElement('hr')); continue }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line), quote = /^>\s?(.*)$/.exec(line)
    const element = document.createElement(heading ? 'h' + heading[1]!.length : quote ? 'blockquote' : 'p')
    inline(element, heading ? heading[2]! : quote ? quote[1]! : line); fragment.append(element)
  }
  return fragment
}

export const editor = Object.freeze({
  create(host: HTMLElement, options: EditorOptions = {}): EditorController {
    const label = (text: string): string => options.translate?.(text) ?? text
    const wrapper = document.createElement('div'); wrapper.className = 'hc-core-editor'
    if (options.splitView) wrapper.classList.add('hc-core-editor--split')
    const toolbar = document.createElement('div'); toolbar.className = 'hc-core-editor__toolbar'
    toolbar.setAttribute('role', 'toolbar'); toolbar.setAttribute('aria-label', label('Formatting'))
    const input = document.createElement('textarea')
    input.setAttribute('aria-label', options.label ?? label('Document')); input.value = options.value ?? ''
    const preview = document.createElement('div'); preview.className = 'hc-core-editor__preview hc-core-markdown'
    preview.setAttribute('aria-label', label('Preview')); preview.hidden = options.showPreview === false
    const status = document.createElement('div'); status.className = 'hc-core-editor__status'
    status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite')
    const buttons: HTMLButtonElement[] = [], undo: string[] = [], redo: string[] = []
    let readOnly = false, alive = true, previous = input.value
    const render = (): void => { if (!preview.hidden) { const fragment = renderMarkdown(input.value, options.resolveImageUrl); options.decoratePreview?.(fragment, input.value); preview.replaceChildren(fragment) } }
    const changed = (): void => { previous = input.value; render(); options.onChange?.(input.value) }
    const checkpoint = (): void => { undo.push(input.value); if (undo.length > 100) undo.shift(); redo.length = 0 }
    const error = (message: string): void => { status.textContent = label(message); options.onError?.(message) }
    const replace = (value: string, start = input.selectionStart, end = input.selectionEnd, caret = start + value.length): void => {
      if (readOnly || !alive) return
      checkpoint(); input.setRangeText(value, start, end, 'end')
      input.focus(); input.setSelectionRange(caret, caret); changed()
    }
    const wrap = (open: string, close = open): void => {
      const start = input.selectionStart, end = input.selectionEnd, selected = input.value.slice(start, end)
      if (start === end && input.value.slice(start - open.length, start) === open && input.value.slice(start, start + close.length) === close) {
        input.focus(); input.setSelectionRange(start + close.length, start + close.length); return
      }
      if (start === end && input.value.slice(start, start + close.length) === close &&
          input.value.lastIndexOf(open, start - open.length) >= input.value.lastIndexOf('\n', start - 1) + 1) {
        input.focus(); input.setSelectionRange(start + close.length, start + close.length); return
      }
      if (input.value.slice(start - open.length, start) === open && input.value.slice(end, end + close.length) === close) {
        replace(selected, start - open.length, end + close.length, start - open.length)
        input.setSelectionRange(start - open.length, end - open.length); return
      }
      if (selected.startsWith(open) && selected.endsWith(close) && selected.length >= open.length + close.length)
        replace(selected.slice(open.length, -close.length), start, end, start)
      else {
        replace(open + selected + close, start, end, start + open.length)
        input.setSelectionRange(start + open.length, end + open.length)
      }
    }
    const prefix = (marker: string): void => {
      const start = input.value.lastIndexOf('\n', Math.max(0, input.selectionStart - 1)) + 1
      const nextBreak = input.value.indexOf('\n', input.selectionEnd)
      const end = nextBreak < 0 ? input.value.length : nextBreak
      const selection = input.value.slice(start, end)
      const next = selection.split('\n').map(line => line.startsWith(marker) ? line.slice(marker.length) : marker + line).join('\n')
      replace(next, start, end, start + next.length)
    }
    const addButton = (name: string, icon: string, action: () => void): void => {
      const button = document.createElement('button')
      button.type = 'button'; button.textContent = icon; button.title = label(name); button.setAttribute('aria-label', label(name))
      button.addEventListener('mousedown', event => event.preventDefault())
      button.addEventListener('click', action); toolbar.append(button); buttons.push(button)
    }
    addButton('Undo', '↶', () => { if (!undo.length || readOnly) return; redo.push(input.value); input.value = undo.pop()!; changed(); input.focus() })
    addButton('Redo', '↷', () => { if (!redo.length || readOnly) return; undo.push(input.value); input.value = redo.pop()!; changed(); input.focus() })
    const headings = document.createElement('select'); headings.setAttribute('aria-label', label('Heading'))
    for (const [value, text] of [['', label('Heading')], ['# ', 'H1'], ['## ', 'H2'], ['### ', 'H3']] as Array<[string, string]>) {
      const option = document.createElement('option'); option.value = value; option.textContent = text; headings.append(option)
    }
    headings.addEventListener('change', () => { if (headings.value) prefix(headings.value); headings.value = '' })
    toolbar.append(headings)
    addButton('Bold', 'B', () => wrap('**'))
    addButton('Italic', 'I', () => wrap('*'))
    addButton('Underline', 'U', () => wrap('<u>', '</u>'))
    addButton('Strikethrough', 'S̶', () => wrap('~~'))
    addButton('Highlight', '▰', () => wrap('<mark>', '</mark>'))
    addButton('Bullet list', '☷', () => prefix('- '))
    addButton('Numbered list', '1.', () => prefix('1. '))
    addButton('Checklist', '☑', () => prefix('- [ ] '))
    addButton('Quote', '❝', () => prefix('> '))
    addButton('Inline code', '</>', () => wrap(String.fromCharCode(96)))
    addButton('Code block', '⌘', () => wrap(String.fromCharCode(96).repeat(3) + '\n', '\n' + String.fromCharCode(96).repeat(3)))
    addButton('Table', '▦', () => replace('| Column 1 | Column 2 |\n| --- | --- |\n| Value | Value |\n'))
    const addUrl = (image: boolean): void => {
      const start = input.selectionStart, end = input.selectionEnd
      const entered = window.prompt(label(image ? 'Image URL (HTTPS)' : 'Link URL (HTTPS)'), 'https://')
      if (entered === null) return
      const url = safeUrl(entered.trim(), image)
      if (!url || /[()\s]/.test(entered)) { error('Invalid URL. Use an HTTPS address.'); return }
      const selected = input.value.slice(start, end) || (image ? label('Image') : entered.trim())
      replace((image ? '!' : '') + '[' + selected.replace(/[\]\n]/g, '') + '](' + entered.trim() + ')', start, end)
    }
    addButton('Link', '🔗', () => addUrl(false))
    addButton('Image URL', '🌐', () => addUrl(true))
    const fileInput = document.createElement('input'); fileInput.type = 'file'
    fileInput.accept = 'image/png,image/jpeg,image/gif,image/webp'; fileInput.hidden = true
    const imageTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
    const addImage = async (file: File): Promise<void> => {
      const start = input.selectionStart, end = input.selectionEnd
      try {
        if (!imageTypes.includes(file.type)) throw new Error('Only PNG, JPEG, GIF and WebP images are supported.')
        let url: string
        if (options.uploadImage) url = await options.uploadImage(file)
        else if (options.embedImages && file.size <= 1024 * 1024) {
          url = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(String(reader.result))
            reader.onerror = () => reject(new Error('Could not read the image.'))
            reader.readAsDataURL(file)
          })
        } else throw new Error('Image upload is unavailable or the embedded image exceeds 1 MiB.')
        if (!alive || readOnly) return
        if (!safeUrl(url, true) || /[()\s]/.test(url)) throw new Error('Image storage returned an unsupported URL.')
        replace('![' + file.name.replace(/[\]\n]/g, '') + '](' + url + ')', start, end)
        status.textContent = ''
      } catch (cause) { error(cause instanceof Error ? cause.message : String(cause)) }
    }
    addButton('Insert image', '🖼', () => fileInput.click())
    const emojiPanel = document.createElement('div'); emojiPanel.className = 'hc-core-editor__picker'; emojiPanel.hidden = true
    const emojiCategory = document.createElement('select'); emojiCategory.setAttribute('aria-label', label('Emoji category'))
    const allEmoji = emojiCatalog()
    for (const category of ['All emoji', ...new Set(allEmoji.map(item => item.category))]) {
      const option = document.createElement('option'); option.value = category; option.textContent = label(category); emojiCategory.append(option)
    }
    const emojiSearch = document.createElement('input'); emojiSearch.type = 'search'; emojiSearch.placeholder = label('Find emoji')
    const emojiGrid = document.createElement('div'); emojiGrid.className = 'hc-core-editor__emoji-grid'
    const showEmoji = (): void => {
      emojiGrid.replaceChildren()
      const category = emojiCategory.value, query = emojiSearch.value.trim().toLowerCase()
      for (const item of allEmoji) {
        if (category !== 'All emoji' && category !== item.category) continue
        if (query && !item.category.toLowerCase().includes(query) && !item.symbol.includes(query)
            && ![...item.symbol].some(char => char.codePointAt(0)?.toString(16).includes(query.replace(/^u\+/, '')))) continue
        const button = document.createElement('button'); button.type = 'button'; button.textContent = item.symbol
        button.title = label(item.category) + ' ' + [...item.symbol].map(char => 'U+' + char.codePointAt(0)?.toString(16).toUpperCase()).join(' ')
        button.addEventListener('click', () => { replace(item.symbol); emojiPanel.hidden = true }); emojiGrid.append(button)
      }
    }
    emojiCategory.addEventListener('change', showEmoji); emojiSearch.addEventListener('input', showEmoji)
    emojiPanel.append(emojiCategory, emojiSearch, emojiGrid)
    addButton('Emoji library', '☺', () => { emojiPanel.hidden = !emojiPanel.hidden; if (!emojiPanel.hidden) { showEmoji(); emojiSearch.focus() } })

    const imagePanel = document.createElement('div'); imagePanel.className = 'hc-core-editor__picker'; imagePanel.hidden = true
    const provider = document.createElement('select'); provider.setAttribute('aria-label', label('Image source'))
    for (const [value, name] of [['openverse', 'Openverse'], ['commons', 'Wikimedia Commons']] as Array<[string, string]>) {
      const option = document.createElement('option'); option.value = value; option.textContent = name; provider.append(option)
    }
    const imageSearch = document.createElement('input'); imageSearch.type = 'search'; imageSearch.placeholder = label('Search free images')
    const searchButton = document.createElement('button'); searchButton.type = 'button'; searchButton.textContent = label('Search')
    const imageResults = document.createElement('div'); imageResults.className = 'hc-core-editor__image-results'
    const searchImages = async (): Promise<void> => {
      const query = imageSearch.value.trim().slice(0, 120); if (!query) return
      searchButton.disabled = true; imageResults.replaceChildren(); status.textContent = label('Searching images…')
      try {
        const isCommons = provider.value === 'commons'
        const api = isCommons ? new URL('https://commons.wikimedia.org/w/api.php') : new URL('https://api.openverse.org/v1/images/')
        if (isCommons) {
          for (const [key, value] of Object.entries({ action: 'query', generator: 'search', gsrsearch: query, gsrnamespace: '6', gsrlimit: '16', prop: 'imageinfo', iiprop: 'url|mime|extmetadata', iiurlwidth: '240', origin: '*', format: 'json' })) api.searchParams.set(key, value)
        } else { api.searchParams.set('q', query); api.searchParams.set('page_size', '16') }
        const response = await fetch(api.toString(), { headers: { Accept: 'application/json' } })
        if (!response.ok) throw new Error('Image search is unavailable.')
        const data = await response.json()
        const values: Array<{ title: string; url: string; thumb: string; page: string; credit: string }> = isCommons
          ? Object.values(data.query?.pages ?? {}).map((item: any) => { const info = item.imageinfo?.[0] ?? {}; const meta = info.extmetadata ?? {}; return { title: String(item.title ?? '').replace(/^File:/, ''), url: String(info.url ?? ''), thumb: String(info.thumburl ?? info.url ?? ''), page: String(info.descriptionurl ?? ''), credit: String(meta.Artist?.value ?? '').replace(/<[^>]*>/g, '') + ' · ' + String(meta.LicenseShortName?.value ?? '') + (String(info.mime ?? '').startsWith('image/') ? '' : ' [unsupported]') } }).filter(item => !item.credit.includes('[unsupported]'))
          : (data.results ?? []).map((item: any) => ({ title: String(item.title ?? 'Image'), url: String(item.url ?? ''), thumb: String(item.thumbnail ?? item.url ?? ''), page: String(item.foreign_landing_url ?? ''), credit: [item.creator, item.license].filter(Boolean).join(' · ') }))
        for (const item of values) {
          const url = safeMarkdownImageUrl(item.url), thumb = safeUrl(item.thumb, true), page = safeUrl(item.page)
          if (!url || !thumb || !page) continue
          const card = document.createElement('button'); card.type = 'button'; card.className = 'hc-core-editor__image-result'
          const img = document.createElement('img'); img.src = thumb; img.alt = ''; img.loading = 'lazy'
          const caption = document.createElement('span'); caption.textContent = item.title + ' · ' + item.credit
          card.append(img, caption)
          card.addEventListener('click', () => {
            const title = item.title.replace(/[\]\r\n]/g, '').slice(0, 100)
            const credit = item.credit.replace(/[\]\r\n]/g, '').slice(0, 200)
            replace(`![${title}](${url})\n\n${label('Source')}: [${credit || title}](${page.replace(/\(/g, '%28').replace(/\)/g, '%29')})`)
            imagePanel.hidden = true; status.textContent = ''
          }); imageResults.append(card)
        }
        status.textContent = imageResults.childElementCount ? label('External images remain hosted by their source.') : label('No images found.')
      } catch { error('Image search is unavailable. Try another source or upload a file.') }
      finally { searchButton.disabled = false }
    }
    searchButton.addEventListener('click', () => void searchImages())
    imageSearch.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); void searchImages() } })
    imagePanel.append(provider, imageSearch, searchButton, imageResults)
    addButton('Free image libraries', '▧', () => { imagePanel.hidden = !imagePanel.hidden; if (!imagePanel.hidden) imageSearch.focus() })

    const colors = document.createElement('input'); colors.type = 'color'; colors.value = '#2475a9'; colors.title = label('Text color'); colors.setAttribute('aria-label', label('Text color'))
    colors.addEventListener('change', () => wrap(`<span style="color:${colors.value}">`, '</span>'))
    toolbar.append(colors)
    const fonts = document.createElement('select'); fonts.setAttribute('aria-label', label('Font'))
    for (const name of ['', 'system-ui', 'Arial', 'Verdana', 'Georgia', 'Times New Roman', 'Courier New']) {
      const option = document.createElement('option'); option.value = name; option.textContent = name || label('Font'); fonts.append(option)
    }
    fonts.addEventListener('change', () => { if (fonts.value) wrap(`<span style="font-family:${fonts.value}">`, '</span>'); fonts.value = '' })
    toolbar.append(fonts)
    addButton('Separator', '―', () => replace('\n---\n'))
    fileInput.addEventListener('change', () => { const file = fileInput.files?.[0]; if (file) void addImage(file); fileInput.value = '' })
    input.addEventListener('paste', event => {
      const file = Array.from(event.clipboardData?.items ?? []).find(item => imageTypes.includes(item.type))?.getAsFile()
      if (file) { event.preventDefault(); void addImage(file) }
    })
    input.addEventListener('keydown', event => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return
      const key = event.key.toLowerCase()
      if (key === 'b' || key === 'i') { event.preventDefault(); wrap(key === 'b' ? '**' : '*') }
    })
    input.addEventListener('input', () => {
      if (!readOnly) {
        undo.push(previous); if (undo.length > 100) undo.shift(); redo.length = 0; changed()
      }
    })
    wrapper.append(toolbar, emojiPanel, imagePanel, fileInput, input, preview, status); host.append(wrapper); render()
    return {
      element: wrapper,
      getValue: () => input.value,
      setValue(value: string): void { input.value = value; undo.length = 0; redo.length = 0; changed() },
      focus(): void { input.focus() },
      insertText(value: string): void { replace(value) },
      setReadOnly(value: boolean): void {
        readOnly = value; input.readOnly = value; headings.disabled = value; fileInput.disabled = value
        emojiCategory.disabled = value; emojiSearch.disabled = value; imageSearch.disabled = value
        searchButton.disabled = value; provider.disabled = value; colors.disabled = value; fonts.disabled = value
        buttons.forEach(button => { button.disabled = value })
      },
      setPreview(visible: boolean): void { preview.hidden = !visible; if (visible) render() },
      destroy(): void { alive = false; wrapper.remove() },
    }
  },
  render: renderMarkdown,
})
