export function generateId(length = 5) {
  return Math.random().toString(36).slice(2, 2 + length);
}

export function getGETParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

export function isConfigKeyLocked(configLock, config, key) {
  if (!configLock) return false;
  if (configLock === true) return Object.prototype.hasOwnProperty.call(config, key);
  if (typeof configLock === 'string') return configLock.split(',').map((entry) => entry.trim()).includes(key);
  if (Array.isArray(configLock)) return configLock.includes(key);
  return false;
}
