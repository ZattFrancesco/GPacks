const typeDrafts = new Map();
const panelDrafts = new Map();

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
  const next = { ...current, ...patch };
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
  const next = { ...current, ...patch };
  panelDrafts.set(k, next);
  return next;
}

function getPanelAdminDraft(guildId, userId) {
  return panelDrafts.get(key(guildId, userId)) || null;
}

function clearPanelAdminDraft(guildId, userId) {
  panelDrafts.delete(key(guildId, userId));
}

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
