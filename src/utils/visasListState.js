// src/utils/visasListState.js

// Petit stockage en mémoire (15 min) pour la pagination + recherche /visas.
// But: éviter de mettre la requête complète dans custom_id (limite 100 chars).

const TTL_MS = 15 * 60 * 1000;

/** @type {Map<string, {expiresAt:number, ownerId:string, guildId:string, query:string, page:number, pageSize:number}>} */
const store = new Map();

function genStateId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function putState(payload) {
  const id = genStateId();
  store.set(id, {
    ...payload,
    expiresAt: Date.now() + TTL_MS,
  });
  return id;
}

function getState(stateId) {
  const v = store.get(String(stateId));
  if (!v) return null;
  if (Date.now() > v.expiresAt) {
    store.delete(String(stateId));
    return null;
  }
  return v;
}

function patchState(stateId, patch) {
  const cur = getState(stateId);
  if (!cur) return null;
  const next = { ...cur, ...patch, expiresAt: Date.now() + TTL_MS };
  store.set(String(stateId), next);
  return next;
}

function clearState(stateId) {
  store.delete(String(stateId));
}

module.exports = {
  putState,
  getState,
  patchState,
  clearState,
};
