export class MemoryWatermarkStore {
  #records = new Map();

  save(record) {
    this.#records.set(record.id, structuredClone(record));
    return record;
  }

  get(id) {
    const record = this.#records.get(id);
    return record ? structuredClone(record) : null;
  }

  list() {
    return [...this.#records.values()].map((record) => structuredClone(record));
  }

  get size() {
    return this.#records.size;
  }
}

