const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

const { getPanel, updatePanel, listTypes } = require("../services/tickets.db");
const { buildPanelEmbed, buildPanelComponents } = require("../src/utils/ticketViews");

/**
 * Rafraîchit le message du panel dans le salon configuré (si présent)
 */
async function refreshPanelMessage(interaction, panelId) {
  const guildId = interaction.guildId;
  const panel = await getPanel(guildId, panelId);
  if (!panel) return;

  try {
    const ch = await interaction.guild.channels.fetch(panel.channel_id);
    if (!ch) return;
    if (!panel.message_id) return;

    const msg = await ch.messages.fetch(panel.message_id).catch(() => null);
    if (!msg) return;

    const allTypes = await listTypes(guildId);
    const typeIds = JSON.parse(panel.type_ids_json || "[]");
    const types = allTypes.filter((t) => typeIds.includes(t.id));

    await msg.edit({
      embeds: [buildPanelEmbed(panel)],
      components: buildPanelComponents({ panel, types }),
    });
  } catch {}
}

function buildBackRow(panelId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticketpanel:edit:back:${panelId}`)
      .setStyle(ButtonStyle.Secondary)
      .setLabel("⬅️ Retour")
  );
}

function buildFieldMenu(panelId) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`ticketpanel:edit:field:${panelId}`)
      .setPlaceholder("Choisis ce que tu veux modifier…")
      .addOptions(
        { label: "Titre", value: "title", emoji: "📝" },
        { label: "Description", value: "description", emoji: "🧾" },
        { label: "Types autorisés", value: "types", emoji: "🎫" },
        { label: "Style (menu / boutons)", value: "style", emoji: "🧩" },
        { label: "Couleur", value: "color", emoji: "🎨" },
        { label: "Rôle requis", value: "required_role_id", emoji: "🔒" },
        { label: "Logo URL", value: "logo_url", emoji: "🖼️" },
        { label: "Banner URL", value: "banner_url", emoji: "🧱" }
      )
  );
}

module.exports = {
  idPrefix: "ticketpanel:edit:",
  async execute(interaction) {
    const guildId = interaction.guildId;
    const customId = interaction.customId;

    // ----- menu "field" -----
    if (customId.startsWith("ticketpanel:edit:field:")) {
      const panelId = customId.split(":")[3];
      const chosen = interaction.values?.[0];
      const panel = await getPanel(guildId, panelId);
      if (!panel) return interaction.reply({ content: "❌ Panel introuvable.", flags: 64 });

      // Champs texte => modal
      if (["title", "description", "logo_url", "banner_url", "color"].includes(chosen)) {
        const modal = new ModalBuilder()
          .setCustomId(`ticketpanel:edit:text:${panelId}:${chosen}`)
          .setTitle(`Modifier ${chosen}`);

        const input = new TextInputBuilder()
          .setCustomId("value")
          .setLabel(chosen === "color" ? "Couleur (hex #RRGGBB ou vide)" : "Nouvelle valeur")
          .setStyle(chosen === "description" ? TextInputStyle.Paragraph : TextInputStyle.Short)
          .setRequired(false);

        // pré-remplissage
        if (chosen === "title") input.setValue(panel.title?.slice(0, 4000) || "");
        if (chosen === "description") input.setValue(panel.description?.slice(0, 4000) || "");
        if (chosen === "logo_url") input.setValue(panel.logo_url?.slice(0, 4000) || "");
        if (chosen === "banner_url") input.setValue(panel.banner_url?.slice(0, 4000) || "");
        if (chosen === "color") {
          // pas de value auto si null
          if (panel.color !== null && panel.color !== undefined) input.setValue(String(panel.color));
        }

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }

      // Types => multi-select
      if (chosen === "types") {
        const allTypes = await listTypes(guildId);
        if (!allTypes.length) {
          return interaction.reply({ content: "❌ Aucun type n'existe. Crée d'abord des types.", flags: 64 });
        }
        const current = new Set(JSON.parse(panel.type_ids_json || "[]"));

        const menu = new StringSelectMenuBuilder()
          .setCustomId(`ticketpanel:edit:types:${panelId}`)
          .setPlaceholder("Choisis les types autorisés…")
          .setMinValues(1)
          .setMaxValues(Math.min(25, allTypes.length));

        for (const t of allTypes.slice(0, 25)) {
          menu.addOptions({
            label: t.label || t.id,
            value: t.id,
            emoji: t.emoji || undefined,
            default: current.has(t.id),
          });
        }

        return interaction.update({
          content: "🎫 Sélectionne les types autorisés, puis valide.",
          embeds: [],
          components: [new ActionRowBuilder().addComponents(menu), buildBackRow(panelId)],
        });
      }

      // Style => select
      if (chosen === "style") {
        const menu = new StringSelectMenuBuilder()
          .setCustomId(`ticketpanel:edit:style:${panelId}`)
          .setPlaceholder("Choisis le style…")
          .addOptions(
            { label: "Menu", value: "menu", emoji: "📋", default: (panel.style || "menu") === "menu" },
            { label: "Boutons", value: "boutons", emoji: "🔘", default: (panel.style || "menu") === "boutons" }
          );

        return interaction.update({
          content: "🧩 Choisis le style du panel.",
          embeds: [],
          components: [new ActionRowBuilder().addComponents(menu), buildBackRow(panelId)],
        });
      }

      // Rôle requis => role select + bouton clear
      if (chosen === "required_role_id") {
        const roleMenu = new RoleSelectMenuBuilder()
          .setCustomId(`ticketpanel:edit:role:${panelId}`)
          .setPlaceholder("Choisis le rôle requis…")
          .setMinValues(1)
          .setMaxValues(1);

        const row1 = new ActionRowBuilder().addComponents(roleMenu);
        const row2 = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`ticketpanel:edit:clearrole:${panelId}`)
            .setStyle(ButtonStyle.Danger)
            .setLabel("Retirer le rôle requis"),
          new ButtonBuilder()
            .setCustomId(`ticketpanel:edit:back:${panelId}`)
            .setStyle(ButtonStyle.Secondary)
            .setLabel("⬅️ Retour")
        );

        return interaction.update({
          content: "🔒 Choisis un rôle requis (ou retire la contrainte).",
          embeds: [],
          components: [row1, row2],
        });
      }

      // fallback
      return interaction.update({
        content: "Choisis un champ à modifier.",
        embeds: [],
        components: [buildFieldMenu(panelId)],
      });
    }

    // ----- submission types -----
    if (customId.startsWith("ticketpanel:edit:types:")) {
      const panelId = customId.split(":")[3];
      const panel = await getPanel(guildId, panelId);
      if (!panel) return interaction.reply({ content: "❌ Panel introuvable.", flags: 64 });

      const chosen = interaction.values || [];
      await updatePanel(guildId, panelId, { type_ids_json: JSON.stringify(chosen) });
      await refreshPanelMessage(interaction, panelId);

      return interaction.update({
        content: "✅ Types mis à jour.",
        embeds: [],
        components: [buildFieldMenu(panelId)],
      });
    }

    // ----- submission style -----
    if (customId.startsWith("ticketpanel:edit:style:")) {
      const panelId = customId.split(":")[3];
      const chosen = (interaction.values?.[0] || "menu").toLowerCase();

      await updatePanel(guildId, panelId, { style: chosen });
      await refreshPanelMessage(interaction, panelId);

      return interaction.update({
        content: "✅ Style mis à jour.",
        embeds: [],
        components: [buildFieldMenu(panelId)],
      });
    }

    // ----- role select -----
    if (customId.startsWith("ticketpanel:edit:role:")) {
      const panelId = customId.split(":")[3];
      const roleId = interaction.values?.[0];
      if (!roleId) return interaction.reply({ content: "❌ Aucun rôle sélectionné.", flags: 64 });

      await updatePanel(guildId, panelId, { required_role_id: roleId });
      await refreshPanelMessage(interaction, panelId);

      return interaction.update({
        content: "✅ Rôle requis mis à jour.",
        embeds: [],
        components: [buildFieldMenu(panelId)],
      });
    }
  },
};
