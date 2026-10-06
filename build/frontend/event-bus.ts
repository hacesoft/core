export type EventMap = Record<string, unknown>
export type EventHandler<T> = (payload: T) => void

export class EventBus<Events extends EventMap = EventMap> {
  private readonly listeners = new Map<keyof Events, Set<EventHandler<never>>>()

  on<Key extends keyof Events>(event: Key, handler: EventHandler<Events[Key]>): () => void {
    const handlers = this.listeners.get(event) ?? new Set<EventHandler<never>>()
    handlers.add(handler as EventHandler<never>)
    this.listeners.set(event, handlers)
    return () => this.off(event, handler)
  }

  off<Key extends keyof Events>(event: Key, handler: EventHandler<Events[Key]>): void {
    const handlers = this.listeners.get(event)
    handlers?.delete(handler as EventHandler<never>)
    if (handlers?.size === 0) this.listeners.delete(event)
  }

  emit<Key extends keyof Events>(event: Key, payload: Events[Key]): void {
    const handlers = this.listeners.get(event)
    if (!handlers) return
    for (const handler of [...handlers]) handler(payload as never)
  }

  clear(): void {
    this.listeners.clear()
  }
}

