/*
 * idb-lite.js
 *
 * Small IndexedDB adapter used by Money follow.  It intentionally exposes the
 * tiny subset of the Dexie API that this app uses, so the database remains
 * fully local/offline without making a third-party CDN a boot-critical
 * dependency.
 */

function cloneValue(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function parseSchema(definition) {
  const parts = String(definition || '').split(',').map((s) => s.trim()).filter(Boolean);
  const primary = parts[0] || '++id';
  const autoIncrement = primary.startsWith('++');
  const keyPath = primary.replace(/^\+\+|^&/, '').replace(/^\+/, '') || 'id';
  const indexes = parts.slice(1).map((part) => part.replace(/^\[|\]$/g, '').trim()).filter(Boolean);
  return { keyPath, autoIncrement, indexes };
}

function schemaStores(definitions) {
  return Object.entries(definitions || {}).map(([name, definition]) => ({
    name,
    ...parseSchema(definition),
  }));
}

class Query {
  constructor(table, field) {
    this.table = table;
    this.field = field;
    this.value = undefined;
    this.sortField = null;
    this.descending = false;
    this.max = null;
  }

  equals(value) {
    this.value = value;
    return this;
  }

  reverse() {
    this.descending = !this.descending;
    return this;
  }

  limit(n) {
    this.max = Number.isFinite(n) ? Math.max(0, n) : null;
    return this;
  }

  async toArray() {
    let rows;
    if (this.sortField) {
      rows = await this.table.toArray();
      rows.sort((a, b) => compareValues(a[this.sortField], b[this.sortField]));
    } else {
      rows = await this.table.toArray();
      if (this.field) rows = rows.filter((row) => valuesEqual(row[this.field], this.value));
    }
    if (this.descending) rows.reverse();
    if (this.max !== null) rows = rows.slice(0, this.max);
    return rows;
  }

  async first() {
    const rows = await this.limit(1).toArray();
    return rows[0];
  }
}

function valuesEqual(a, b) {
  if (a === b) return true;
  // IndexedDB/Dexie commonly compares dates by value in this app.
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return false;
}

function compareValues(a, b) {
  if (a === b) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  const av = a instanceof Date ? a.getTime() : a;
  const bv = b instanceof Date ? b.getTime() : b;
  if (av < bv) return -1;
  if (av > bv) return 1;
  return 0;
}

export class Dexie {
  constructor(name) {
    this.name = name;
    this._versions = [];
    this._schema = {};
    this._openPromise = null;
    this._tables = new Map();
    this._txDepth = 0;
  }

  version(number) {
    const v = Number(number);
    const record = { number: v, stores: {} };
    this._versions.push(record);
    return {
      stores: (definitions) => {
        record.stores = { ...definitions };
        for (const [name, definition] of Object.entries(definitions || {})) {
          this._schema[name] = parseSchema(definition);
          if (!this._tables.has(name)) {
            const table = new Table(this, name);
            this._tables.set(name, table);
            if (!Object.prototype.hasOwnProperty.call(this, name)) {
              Object.defineProperty(this, name, { enumerable: true, configurable: true, get: () => this._table(name) });
            }
          }
        }
        return this;
      },
    };
  }

  get tables() {
    return Array.from(this._tables.values());
  }

  _latestVersion() {
    return this._versions.reduce((max, item) => Math.max(max, item.number), 1);
  }

  async _open() {
    if (this._openPromise) return this._openPromise;
    if (!('indexedDB' in globalThis)) throw new Error('IndexedDB is not available in this browser.');

    this._openPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.name, this._latestVersion());

      request.onupgradeneeded = (event) => {
        const database = request.result;
        const oldVersion = event.oldVersion || 0;
        const latest = schemaStores(this._latestStoreDefinitions());

        for (const spec of latest) {
          let store;
          if (!database.objectStoreNames.contains(spec.name)) {
            store = database.createObjectStore(spec.name, {
              keyPath: spec.keyPath,
              autoIncrement: spec.autoIncrement,
            });
          } else {
            store = request.transaction.objectStore(spec.name);
          }
          for (const indexName of spec.indexes) {
            if (!store.indexNames.contains(indexName) && indexName !== spec.keyPath) {
              try { store.createIndex(indexName, indexName, { unique: false }); } catch (_) { /* already exists */ }
            }
          }
        }

        // Keep the version callback alive for the browser and make the intent
        // explicit for upgrades from the original Dexie v1/v2 database.
        void oldVersion;
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Unable to open MoneyFollowDB.'));
      request.onblocked = () => reject(new Error('MoneyFollowDB is blocked by another open tab.'));
    });

    try {
      return await this._openPromise;
    } catch (error) {
      this._openPromise = null;
      throw error;
    }
  }

  _latestStoreDefinitions() {
    const merged = {};
    for (const version of this._versions.sort((a, b) => a.number - b.number)) {
      Object.assign(merged, version.stores || {});
    }
    return merged;
  }

  _table(name) {
    if (!this._tables.has(name)) {
      const table = new Table(this, name);
      this._tables.set(name, table);
      if (!Object.prototype.hasOwnProperty.call(this, name)) {
        Object.defineProperty(this, name, { enumerable: true, configurable: true, get: () => this._table(name) });
      }
    }
    return this._tables.get(name);
  }

  get [Symbol.toStringTag]() {
    return 'Dexie';
  }

  async transaction(_mode, _tables, callback) {
    // The app uses this as an atomicity hint. The adapter keeps the same async
    // calling contract; individual IndexedDB operations are transactional.
    return callback();
  }
}

class Table {
  constructor(db, name) {
    this.db = db;
    this.name = name;
  }

  async _request(mode, action) {
    const database = await this.db._open();
    return new Promise((resolve, reject) => {
      let result;
      const tx = database.transaction(this.name, mode);
      const store = tx.objectStore(this.name);
      try {
        result = action(store);
      } catch (error) {
        reject(error);
        return;
      }
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error || new Error(`IndexedDB transaction failed for ${this.name}.`));
      tx.onabort = () => reject(tx.error || new Error(`IndexedDB transaction aborted for ${this.name}.`));
    });
  }

  async get(key) {
    return this._request('readonly', (store) => new Promise((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result === undefined ? undefined : cloneValue(req.result));
      req.onerror = () => reject(req.error);
    }));
  }

  async add(value) {
    const copy = cloneValue(value);
    return this._request('readwrite', (store) => new Promise((resolve, reject) => {
      const req = store.add(copy);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }));
  }

  async put(value) {
    const copy = cloneValue(value);
    return this._request('readwrite', (store) => new Promise((resolve, reject) => {
      const req = store.put(copy);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }));
  }

  async update(key, changes) {
    return this._request('readwrite', (store) => new Promise((resolve, reject) => {
      const getReq = store.get(key);
      getReq.onerror = () => reject(getReq.error);
      getReq.onsuccess = () => {
        if (getReq.result === undefined) { resolve(0); return; }
        const updated = { ...getReq.result, ...cloneValue(changes) };
        const putReq = store.put(updated);
        putReq.onerror = () => reject(putReq.error);
        putReq.onsuccess = () => resolve(1);
      };
    }));
  }

  async delete(key) {
    return this._request('readwrite', (store) => new Promise((resolve, reject) => {
      const req = store.delete(key);
      req.onsuccess = () => resolve(undefined);
      req.onerror = () => reject(req.error);
    }));
  }

  async clear() {
    return this._request('readwrite', (store) => new Promise((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    }));
  }

  async bulkAdd(values) {
    const items = Array.isArray(values) ? values.map(cloneValue) : [];
    return this._request('readwrite', (store) => new Promise((resolve, reject) => {
      if (items.length === 0) { resolve([]); return; }
      let remaining = items.length;
      const keys = [];
      let failed = false;
      items.forEach((item) => {
        const req = store.add(item);
        req.onsuccess = () => {
          keys.push(req.result);
          if (--remaining === 0 && !failed) resolve(keys);
        };
        req.onerror = () => {
          if (!failed) {
            failed = true;
            reject(req.error);
          }
        };
      });
    }));
  }

  async toArray() {
    return this._request('readonly', (store) => new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result || []).map(cloneValue));
      req.onerror = () => reject(req.error);
    }));
  }

  orderBy(field) {
    const q = new Query(this);
    q.sortField = field;
    return q;
  }

  where(field) {
    return new Query(this, field);
  }
}
