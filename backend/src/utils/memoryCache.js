/**
 * In-Memory LRU/TTL Cache implementation (Scheme A).
 * Uses a native Map to store data and a timer to clean up expired entries.
 * Suitable for single-server setups to reduce database or API load without external dependencies.
 */

class MemoryCache {
  constructor(defaultTtlSeconds = 3600) {
    this.cache = new Map();
    this.defaultTtlMs = defaultTtlSeconds * 1000;
  }

  /**
   * Generates a simple hash string from an object or string for use as a cache key.
   */
  generateKey(prefix, data) {
    const stringified = typeof data === 'string' ? data : JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < stringified.length; i++) {
      const char = stringified.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `${prefix}:${hash}`;
  }

  /**
   * Store a value in the cache.
   * @param {string} key Cache key
   * @param {any} value Value to store
   * @param {number} [ttlSeconds] Optional specific TTL for this entry
   */
  set(key, value, ttlSeconds) {
    const ttlMs = ttlSeconds !== undefined ? ttlSeconds * 1000 : this.defaultTtlMs;
    const expiry = Date.now() + ttlMs;
    
    // Clear existing timeout if overwriting
    if (this.cache.has(key)) {
      clearTimeout(this.cache.get(key).timeoutId);
    }

    const timeoutId = setTimeout(() => {
      this.cache.delete(key);
    }, ttlMs);

    // Ensure the timeout doesn't block the Node.js process from exiting
    if (timeoutId.unref) {
      timeoutId.unref();
    }

    this.cache.set(key, { value, expiry, timeoutId });
  }

  /**
   * Retrieve a value from the cache.
   * @param {string} key Cache key
   * @returns {any|null} The cached value or null if not found/expired
   */
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.delete(key);
      return null;
    }

    return item.value;
  }

  /**
   * Delete a value from the cache.
   * @param {string} key Cache key
   */
  delete(key) {
    const item = this.cache.get(key);
    if (item) {
      clearTimeout(item.timeoutId);
      this.cache.delete(key);
    }
  }

  /**
   * Clear the entire cache.
   */
  clear() {
    for (const [key, item] of this.cache.entries()) {
      clearTimeout(item.timeoutId);
    }
    this.cache.clear();
  }
}

// Export a singleton instance with a default TTL of 12 hours
export const memoryCache = new MemoryCache(12 * 60 * 60);
