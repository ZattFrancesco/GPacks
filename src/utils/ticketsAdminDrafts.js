const typeDrafts = new Map();
const panelDrafts = new Map();
const TTL_MS = 15 * 60 * 1000; // 15 minutes

function key(guildId, userId) {
  return `${guildId}:${userId}`;
}

function getDefaultTypeDraft() {
  return {
    id: "",
    label: "",
    emoji: "",
    categoryOpenedId: null,
    staffRoleIds: [],
    openPingRoleId: null,
    nameModalRename: false,
    customEmbedEnabled: false,
    customEmbedTitle: null,
    customEmbedDescription: null,
  };
}

function getDefaultPanelDraft() {
  return {
    id: "",
    channelId: null,
    title: "",
    description: "",
    color: null,
    style: "menu",
    requiredRoleId: null,
    logoUrl: null,
    bannerUrl: null,
    typeIds: [],
  };
}

function setTypeAdminDraft(guildId, userId, patch = {}) {
  const k = key(guildId, userId);
  const current = typeDrafts.get(k) || getDefaultTypeDraft();
  const next = { ...current, ...patch, _createdAt: current._createdAt || Date.now() };
  typeDrafts.set(k, next);
  return next;
}

function getTypeAdminDraft(guildId, userId) {
  return typeDrafts.get(key(guildId, userId)) || null;
}

function clearTypeAdminDraft(guildId, userId) {
  typeDrafts.delete(key(guildId, userId));
}

function setPanelAdminDraft(guildId, userId, patch = {}) {
  const k = key(guildId, userId);
  const current = panelDrafts.get(k) || getDefaultPanelDraft();
  const next = { ...current, ...patch, _createdAt: current._createdAt || Date.now() };
  panelDrafts.set(k, next);
  return next;
}

function getPanelAdminDraft(guildId, userId) {
  return panelDrafts.get(key(guildId, userId)) || null;
}

function clearPanelAdminDraft(guildId, userId) {
  panelDrafts.delete(key(guildId, userId));
}

// Nettoyage automatique
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of typeDrafts.entries()) {
    if (v?._createdAt && now - v._createdAt > TTL_MS) typeDrafts.delete(k);
  }
  for (const [k, v] of panelDrafts.entries()) {
    if (v?._createdAt && now - v._createdAt > TTL_MS) panelDrafts.delete(k);
  }
}, 60 * 1000).unref?.();

module.exports = {
  getDefaultTypeDraft,
  getDefaultPanelDraft,
  setTypeAdminDraft,
  getTypeAdminDraft,
  clearTypeAdminDraft,
  setPanelAdminDraft,
  getPanelAdminDraft,
  clearPanelAdminDraft,
};
