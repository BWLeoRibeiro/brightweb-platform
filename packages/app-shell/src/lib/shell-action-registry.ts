export type ShellActionHandler = (detail?: unknown) => void;
export type ShellActionAliases = Readonly<Record<string, string>>;

/**
 * Vanilla registry backing the shell action system. The shell header invokes
 * registered handlers directly instead of firing fire-and-forget window
 * events, so an action can only be triggered once its target handler is
 * mounted. Alias support lets the shell map toolbar action ids (e.g.
 * "projects-refresh") onto the event-style types modules register
 * (e.g. "projects:refresh").
 */
export class ShellActionRegistry {
  private handlers = new Map<string, ShellActionHandler>();
  private listeners = new Set<() => void>();
  private snapshot: ReadonlySet<string> = new Set();
  private aliases: ShellActionAliases;

  constructor(aliases: ShellActionAliases = {}) {
    this.aliases = aliases;
  }

  resolveType(type: string): string {
    return this.aliases[type] ?? type;
  }

  setAliases(aliases: ShellActionAliases): void {
    this.aliases = aliases;
  }

  /**
   * Registers a handler for an action type. The latest registration wins.
   * Returns an unregister function that only removes the handler if it is
   * still the live one (so StrictMode-style register/unregister/register
   * sequences keep exactly one live handler).
   */
  register(type: string, handler: ShellActionHandler): () => void {
    const resolved = this.resolveType(type);
    this.handlers.set(resolved, handler);
    this.emit();
    return () => {
      if (this.handlers.get(resolved) === handler) {
        this.handlers.delete(resolved);
        this.emit();
      }
    };
  }

  isReady(type: string): boolean {
    return this.handlers.has(this.resolveType(type));
  }

  areReady(types: readonly string[]): boolean {
    return types.every((type) => this.isReady(type));
  }

  /** Invokes the registered handler. Returns false when none is registered. */
  invoke(type: string, detail?: unknown): boolean {
    const handler = this.handlers.get(this.resolveType(type));
    if (!handler) return false;
    handler(detail);
    return true;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Stable snapshot of the registered (alias-resolved) action types. */
  getRegisteredTypes(): ReadonlySet<string> {
    return this.snapshot;
  }

  private emit(): void {
    this.snapshot = new Set(this.handlers.keys());
    for (const listener of [...this.listeners]) listener();
  }
}
