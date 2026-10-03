/** Bounded execution cache; layout and viewport never occur in a key. */
export class GraphExecutionCache<T> {
  #entries = new Map<string, { key: string; value: T }>();
  #signatures = new Map<string, { key: string; revision: number }>();
  #next = 0;
  constructor(
    readonly maxEntries = 64,
    readonly maxBytes = 32 * 1024 * 1024,
    readonly size: (value: T) => number = () => 1,
  ) {}
  get(id: string, key: string): { value: T } | undefined {
    const entry = this.#entries.get(id);
    if (entry?.key !== key) return;
    this.#entries.delete(id);
    this.#entries.set(id, entry);
    return entry;
  }
  revision(id: string, key: string): number {
    const prior = this.#signatures.get(id);
    if (prior?.key === key) return prior.revision;
    const revision = ++this.#next;
    this.#signatures.set(id, { key, revision });
    return revision;
  }
  put(id: string, key: string, value: T): void {
    this.#entries.delete(id);
    if (this.size(value) <= this.maxBytes)
      this.#entries.set(id, { key, value });
    while (this.#entries.size > this.maxEntries || this.bytes > this.maxBytes)
      this.#entries.delete(this.#entries.keys().next().value!);
  }
  retain(ids: ReadonlySet<string>): void {
    for (const id of this.#entries.keys())
      if (!ids.has(id)) this.#entries.delete(id);
    for (const id of this.#signatures.keys())
      if (!ids.has(id)) this.#signatures.delete(id);
  }
  get bytes(): number {
    const unique = new Set([...this.#entries.values()].map((e) => e.value));
    return [...unique].reduce((sum, value) => sum + this.size(value), 0);
  }
  get count(): number {
    return this.#entries.size;
  }
  clear(): void {
    this.#entries.clear();
    this.#signatures.clear();
  }
}
