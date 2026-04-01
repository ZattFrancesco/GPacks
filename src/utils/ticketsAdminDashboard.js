const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
} = require("discord.js");

function boolLabel(v) {
  return v ? "✅ Oui" : "❌ Non";
}

function roleLabel(roleId) {
  return roleId ? `<@&${roleId}>` : "—";
}

function rolesLabel(roleIds) {
  if (!Array.isArray(roleIds) || !roleIds.length) return "—";
  return roleIds.map((id) => `<@&${id}>`).join(" ");
}

function typesLabel(typeIds, allTypes = []) {
  if (!Array.isArray(typeIds) || !typeIds.length) return "—";
  const map = new Map((allTypes || []).map((t) => [String(t.id), t]));
  return typeIds
    .map((id) => {
      const t = map.get(String(id));
      if (!t) return `\`${id}\``;
      return `${t.emoji ? `${t.emoji} ` : ""}${t.label || t.id} (\`${t.id}\`)`;
    })
    .join("\n");
}

function buildHomeView(guild, stats = {}) {
  const embed = new EmbedBuilder()
    .setTitle("🎫 Dashboard tickets")
    .setDescription("Centralise la gestion des **types** et des **panels** depuis une seule interface.")
    .addFields(
      { name: "Types", value: `**${stats.typeCount || 0}**`, inline: true },
      { name: "Panels", value: `**${stats.panelCount || 0}**`, inline: true },
      { name: "Serveur", value: guild?.name || "—", inline: true },
      {
        name: "Actions",
        value:
          "• Gérer les types\n" +
          "• Gérer les panels\n" +
          "• Créer sans slash à rallonge\n" +
          "• Réutiliser l'édition déjà existante",
        inline: false,
      }
    )
    .setColor(0x2b2d31);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticketsadmin:nav:types")
      .setLabel("Gérer les types")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("ticketsadmin:nav:panels")
      .setLabel("Gérer les panels")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("ticketsadmin:refresh")
      .setLabel("Rafraîchir")
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row] };
}

function buildTypesListView(types = []) {
  const lines = types.length
    ? types.slice(0, 20).map((t) => `• ${t.emoji ? `${t.emoji} ` : ""}**${t.label || t.id}** — \`${t.id}\``)
    : ["Aucun type enregistré."];

  const embed = new EmbedBuilder()
    .setTitle("🧩 Gestion des types")
    .setDescription(lines.join("\n"))
    .setColor(0x5865f2)
    .setFooter({ text: types.length > 20 ? `Affichage des 20 premiers sur ${types.length}` : `${types.length} type(s)` });

  const rows = [];

  if (types.length) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("ticketsadmin:type:pick")
          .setPlaceholder("Choisis un type à modifier…")
          .addOptions(
            types.slice(0, 25).map((t) => ({
              label: (t.label || t.id).slice(0, 100),
              value: t.id,
              description: `ID: ${t.id}`.slice(0, 100),
              emoji: t.emoji || undefined,
            }))
          )
      )
    );
  }

  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ticketsadmin:type:create:start")
        .setLabel("Créer un type")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("ticketsadmin:type:delete:start")
        .setLabel("Supprimer un type")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!types.length),
      new ButtonBuilder()
        .setCustomId("ticketsadmin:home")
        .setLabel("Retour")
        .setStyle(ButtonStyle.Secondary)
    )
  );

  if (types.length) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("ticketsadmin:type:delete:pick")
          .setPlaceholder("Choisis un type à supprimer…")
          .addOptions(
            types.slice(0, 25).map((t) => ({
              label: (t.label || t.id).slice(0, 100),
              value: t.id,
              description: `Supprimer ${t.id}`.slice(0, 100),
              emoji: t.emoji || undefined,
            }))
          )
      )
    );
  }

  return { embeds: [embed], components: rows };
}

function buildPanelsListView(panels = []) {
  const lines = panels.length
    ? panels.slice(0, 20).map((p) => `• **${p.title || p.id}** — \`${p.id}\` • <#${p.channel_id}>`)
    : ["Aucun panel enregistré."];

  const embed = new EmbedBuilder()
    .setTitle("📁 Gestion des panels")
    .setDescription(lines.join("\n"))
    .setColor(0x57f287)
    .setFooter({ text: panels.length > 20 ? `Affichage des 20 premiers sur ${panels.length}` : `${panels.length} panel(s)` });

  const rows = [];

  if (panels.length) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("ticketsadmin:panel:pick")
          .setPlaceholder("Choisis un panel à modifier…")
          .addOptions(
            panels.slice(0, 25).map((p) => ({
              label: (p.title || p.id).slice(0, 100),
              value: p.id,
              description: `ID: ${p.id}`.slice(0, 100),
            }))
          )
      )
    );
  }

  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ticketsadmin:panel:create:start")
        .setLabel("Créer un panel")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("ticketsadmin:panel:delete:start")
        .setLabel("Supprimer un panel")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!panels.length),
      new ButtonBuilder()
        .setCustomId("ticketsadmin:home")
        .setLabel("Retour")
        .setStyle(ButtonStyle.Secondary)
    )
  );

  if (panels.length) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("ticketsadmin:panel:delete:pick")
          .setPlaceholder("Choisis un panel à supprimer…")
          .addOptions(
            panels.slice(0, 25).map((p) => ({
              label: (p.title || p.id).slice(0, 100),
              value: p.id,
              description: `Supprimer ${p.id}`.slice(0, 100),
            }))
          )
      )
    );
  }

  return { embeds: [embed], components: rows };
}

function buildTypeCreateView(guild, draft = {}) {
  const embed = new EmbedBuilder()
    .setTitle("🆕 Création d'un type")
    .setDescription("Complète le brouillon puis valide l'enregistrement.")
    .addFields(
      { name: "ID", value: draft.id ? `\`${draft.id}\`` : "—", inline: true },
      { name: "Label", value: draft.label || "—", inline: true },
      { name: "Emoji", value: draft.emoji || "—", inline: true },
      { name: "Catégorie", value: draft.categoryOpenedId ? `<#${draft.categoryOpenedId}>` : "—", inline: true },
      { name: "Ping à l'ouverture", value: roleLabel(draft.openPingRoleId), inline: true },
      { name: "Rename nom/prénom", value: boolLabel(draft.nameModalRename), inline: true },
      { name: "Rôles staff", value: rolesLabel(draft.staffRoleIds), inline: false },
      {
        name: "Custom embed",
        value: draft.customEmbedEnabled
          ? `✅ Activé\nTitre: ${draft.customEmbedTitle || "—"}\nDescription: ${draft.customEmbedDescription ? "définie" : "—"}`
          : "❌ Désactivé",
        inline: false,
      }
    )
    .setColor(0x5865f2)
    .setFooter({ text: guild?.name || "Tickets" });

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("ticketsadmin:type:create:general").setLabel("Infos générales").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("ticketsadmin:type:create:customembed").setLabel("Custom embed").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("ticketsadmin:type:create:toggleRename").setLabel("Toggle rename").setStyle(ButtonStyle.Secondary)
      ),
      new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId("ticketsadmin:type:create:category")
          .setPlaceholder("Choisir la catégorie d'ouverture")
          .setMinValues(1)
          .setMaxValues(1)
          .addChannelTypes(ChannelType.GuildCategory),
      ),
      new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder()
          .setCustomId("ticketsadmin:type:create:roles")
          .setPlaceholder("Choisir les rôles staff")
          .setMinValues(1)
          .setMaxValues(10)
      ),
      new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder()
          .setCustomId("ticketsadmin:type:create:openping")
          .setPlaceholder("Choisir le rôle à ping à l'ouverture")
          .setMinValues(1)
          .setMaxValues(1)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("ticketsadmin:type:create:clearopenping").setLabel("Retirer le ping").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("ticketsadmin:type:create:save").setLabel("Enregistrer").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("ticketsadmin:nav:types").setLabel("Annuler").setStyle(ButtonStyle.Secondary)
      ),
    ],
  };
}

function buildPanelCreateView(guild, draft = {}, allTypes = []) {
  const embed = new EmbedBuilder()
    .setTitle("🆕 Création d'un panel")
    .setDescription("Complète le brouillon puis valide l'envoi du panel.")
    .addFields(
      { name: "ID", value: draft.id ? `\`${draft.id}\`` : "—", inline: true },
      { name: "Salon", value: draft.channelId ? `<#${draft.channelId}>` : "—", inline: true },
      { name: "Style", value: draft.style || "menu", inline: true },
      { name: "Titre", value: draft.title || "—", inline: false },
      { name: "Description", value: draft.description || "—", inline: false },
      { name: "Couleur", value: draft.color === null || draft.color === undefined ? "—" : `\`${draft.color}\``, inline: true },
      { name: "Rôle requis", value: roleLabel(draft.requiredRoleId), inline: true },
      { name: "Types liés", value: typesLabel(draft.typeIds, allTypes), inline: false },
      { name: "Logo URL", value: draft.logoUrl || "—", inline: false },
      { name: "Banner URL", value: draft.bannerUrl || "—", inline: false },
    )
    .setColor(0x57f287)
    .setFooter({ text: guild?.name || "Tickets" });

  const typeOptions = (allTypes || []).slice(0, 25).map((t) => ({
    label: (t.label || t.id).slice(0, 100),
    value: t.id,
    emoji: t.emoji || undefined,
    description: `ID: ${t.id}`.slice(0, 100),
    default: Array.isArray(draft.typeIds) && draft.typeIds.includes(t.id),
  }));

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("ticketsadmin:panel:create:general").setLabel("Infos générales").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("ticketsadmin:panel:create:style").setLabel("Style").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("ticketsadmin:panel:create:clearrole").setLabel("Retirer rôle requis").setStyle(ButtonStyle.Danger)
      ),
      new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId("ticketsadmin:panel:create:channel")
          .setPlaceholder("Choisir le salon du panel")
          .setMinValues(1)
          .setMaxValues(1)
      ),
      ...(typeOptions.length
        ? [new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId("ticketsadmin:panel:create:types")
              .setPlaceholder("Choisir les types liés")
              .setMinValues(1)
              .setMaxValues(Math.min(25, typeOptions.length))
              .addOptions(typeOptions)
          )]
        : []),
      new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder()
          .setCustomId("ticketsadmin:panel:create:requiredrole")
          .setPlaceholder("Choisir le rôle requis")
          .setMinValues(1)
          .setMaxValues(1)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("ticketsadmin:panel:create:save").setLabel("Enregistrer et poster").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("ticketsadmin:nav:panels").setLabel("Annuler").setStyle(ButtonStyle.Secondary)
      )
    ],
  };
}

module.exports = {
  buildHomeView,
  buildTypesListView,
  buildPanelsListView,
  buildTypeCreateView,
  buildPanelCreateView,
};
