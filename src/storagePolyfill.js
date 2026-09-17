// Minimal localStorage-backed replacement for the Claude Artifacts
// `window.storage` API. App.jsx was written against that API, so this
// shim lets it run unmodified as a normal web app.
//
// IMPORTANT: localStorage is per-browser, per-device. Two tablets will
// each have their own separate trainee list — they do NOT sync with
// each other. See the README for options if you need every tablet to
// share the same data.

const NS = "trainer-tracker:";

if (typeof window !== "undefined" && !window.storage) {
  window.storage = {
    async get(key) {
      const raw = localStorage.getItem(NS + key);
      if (raw === null) return null;
      return { key, value: raw, shared: false };
    },
    async set(key, value) {
      localStorage.setItem(NS + key, value);
      return { key, value, shared: false };
    },
    async delete(key) {
      const existed = localStorage.getItem(NS + key) !== null;
      localStorage.removeItem(NS + key);
      return { key, deleted: existed, shared: false };
    },
    async list(prefix) {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(NS)) {
          const bare = k.slice(NS.length);
          if (!prefix || bare.startsWith(prefix)) keys.push(bare);
        }
      }
      return { keys, prefix, shared: false };
    },
  };
}
