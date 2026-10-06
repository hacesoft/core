export type ConfigValue = string | number | boolean | null
export type CoreConfig = Readonly<Record<string, ConfigValue>>

export class Config {
  private readonly values = new Map<string, ConfigValue>()

  constructor(initial: CoreConfig = {}) {
    Object.entries(initial).forEach(([key, value]) => this.values.set(key, value))
  }

  get<T extends ConfigValue>(key: string, fallback: T): T {
    return (this.values.has(key) ? this.values.get(key) : fallback) as T
  }

  set(key: string, value: ConfigValue): void {
    this.values.set(key, value)
  }

  snapshot(): CoreConfig {
    return Object.freeze(Object.fromEntries(this.values))
  }
}

