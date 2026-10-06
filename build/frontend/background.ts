import { settings } from './settings'

export type BackgroundChoice =
  | { mode: 'none' }
  | { mode: 'solid'; color: string }
  | { mode: 'gradient'; color: string }
  | { mode: 'image'; url: string }

export interface BackgroundController {
  apply(choice: BackgroundChoice): void
  load(): Promise<BackgroundChoice>
  save(choice: BackgroundChoice): Promise<void>
  destroy(): void
}

const validColor = (value: string): boolean => /^#[0-9a-fA-F]{6}$/.test(value)
const validate = (choice: BackgroundChoice): BackgroundChoice => {
  if (choice.mode === 'none') return { mode: 'none' }
  if (choice.mode === 'solid' || choice.mode === 'gradient') {
    if (!validColor(choice.color)) throw new Error('Invalid background color.')
    return { mode: choice.mode, color: choice.color }
  }
  try {
    const url = new URL(choice.url)
    if (url.protocol === 'https:' && url.username === '' && url.password === '') return { mode: 'image', url: url.href }
  } catch { /* Invalid URL. */ }
  throw new Error('Background image needs an HTTPS URL without credentials.')
}

export const background = Object.freeze({
  create(host: HTMLElement, settingsEndpoint: string, namespace: string): BackgroundController {
    const client = settings.create(settingsEndpoint, namespace)
    const original = { image: host.style.backgroundImage, color: host.style.backgroundColor, size: host.style.backgroundSize }
    let destroyed = false
    const apply = (input: BackgroundChoice): void => {
      if (destroyed) throw new Error('Background controller has been destroyed.')
      const choice = validate(input)
      host.style.backgroundColor = choice.mode === 'solid' ? choice.color : ''
      host.style.backgroundImage = choice.mode === 'gradient'
        ? `linear-gradient(135deg, ${choice.color}, transparent)`
        : choice.mode === 'image' ? `url("${choice.url.replace(/"/g, '%22')}")` : ''
      host.style.backgroundSize = choice.mode === 'image' ? 'cover' : ''
    }
    const load = async (): Promise<BackgroundChoice> => {
      const data = await client.load()
      let choice: BackgroundChoice = { mode: 'none' }
      try {
        if (data.backgroundMode === 'solid' || data.backgroundMode === 'gradient') choice = validate({ mode: data.backgroundMode, color: String(data.backgroundColor ?? '') })
        if (data.backgroundMode === 'image') choice = validate({ mode: 'image', url: String(data.backgroundUrl ?? '') })
      } catch { /* Invalid saved settings fall back to no background. */ }
      apply(choice)
      return choice
    }
    return {
      apply,
      load,
      async save(input: BackgroundChoice): Promise<void> {
        const choice = validate(input)
        const values = await client.load()
        await client.save({ ...values, backgroundMode: choice.mode,
          backgroundColor: choice.mode === 'solid' || choice.mode === 'gradient' ? choice.color : '',
          backgroundUrl: choice.mode === 'image' ? choice.url : '' })
        apply(choice)
      },
      destroy(): void {
        if (destroyed) return
        destroyed = true
        host.style.backgroundImage = original.image; host.style.backgroundColor = original.color; host.style.backgroundSize = original.size
      },
    }
  },
})
