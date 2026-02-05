// src/utils/defconUtils.js
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");
const defconDb = require("../../services/defcon.db");

function formatColor(c) {
  if (c === null || c === undefined) return "Default";
  const hex = Number(c).toString(16).padStart(6, "0");
  return `#${hex}`;
}

function clip(s, n = 200) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function buildConfigButtons() {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("defconcfg:1").setLabel("Defcon 1").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("defconcfg:2").setLabel("Defcon 2").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("defconcfg:3").setLabel("Defcon 3").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("defconcfg:4").setLabel("Defcon 4").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("defconcfg:5").setLabel("Defcon 5").setStyle(ButtonStyle.Secondary)
  );
  return [row];
}

async function buildConfigEmbed(client) {
  const [d1, d2, d3, d4, d5] = await Promise.all([
    defconDb.getDefconMessage(1),
    defconDb.getDefconMessage(2),
    defconDb.getDefconMessage(3),
    defconDb.getDefconMessage(4),
    defconDb.getDefconMessage(5),
  ]);

  const e = new EmbedBuilder()
    .setTitle("Dashboard DEFCON (global)")
    .setDescription(
      "Configure les messages DEFCON. Les changements sont **globaux** (pas par serveur).\n" +
        "Le **salon d'envoi** se configure **par serveur** via `/set-defcon-channel`."
    )
    .addFields(
      {
        name: "Salon d'envoi",
        value: "📌 Configuré **par serveur** avec `/set-defcon-channel`.",
        inline: false,
      },
      {
        name: "DEFCON 1",
        value:
          `Couleur: **${formatColor(d1?.color)}**\n` +
          `Footer: ${d1?.footer ? `**${clip(d1.footer, 60)}**` : "_(vide)_"}\n` +
          `Message: ${d1?.message ? `\n> ${clip(d1.message, 250).replace(/\n/g, "\n> ")}` : "_(vide)_"}`,
      },
      {
        name: "DEFCON 2",
        value:
          `Couleur: **${formatColor(d2?.color)}**\n` +
          `Footer: ${d2?.footer ? `**${clip(d2.footer, 60)}**` : "_(vide)_"}\n` +
          `Message: ${d2?.message ? `\n> ${clip(d2.message, 250).replace(/\n/g, "\n> ")}` : "_(vide)_"}`,
      },
      {
        name: "DEFCON 3",
        value:
          `Couleur: **${formatColor(d3?.color)}**\n` +
          `Footer: ${d3?.footer ? `**${clip(d3.footer, 60)}**` : "_(vide)_"}\n` +
          `Message: ${d3?.message ? `\n> ${clip(d3.message, 250).replace(/\n/g, "\n> ")}` : "_(vide)_"}`,
      },
      {
        name: "DEFCON 4",
        value:
          `Couleur: **${formatColor(d4?.color)}**\n` +
          `Footer: ${d4?.footer ? `**${clip(d4.footer, 60)}**` : "_(vide)_"}\n` +
          `Message: ${d4?.message ? `\n> ${clip(d4.message, 250).replace(/\n/g, "\n> ")}` : "_(vide)_"}`,
      },
      {
        name: "DEFCON 5",
        value:
          `Couleur: **${formatColor(d5?.color)}**\n` +
          `Footer: ${d5?.footer ? `**${clip(d5.footer, 60)}**` : "_(vide)_"}\n` +
          `Message: ${d5?.message ? `\n> ${clip(d5.message, 250).replace(/\n/g, "\n> ")}` : "_(vide)_"}`,
      }
    );

  // (optionnel) petite trace visuelle de quel bot répond
  if (client?.user?.username) {
    e.setFooter({ text: `Bot: ${client.user.username}` });
  }

  return e;
}

function parseColorInput(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;

  // Accept: "#ff00aa", "ff00aa", "0xff00aa", "16711680"
  let v = s;
  if (v.startsWith("0x")) v = v.slice(2);
  if (v.startsWith("#")) v = v.slice(1);

  if (/^[0-9a-fA-F]{6}$/.test(v)) {
    return parseInt(v, 16);
  }
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n) && n >= 0 && n <= 0xffffff) return n;
  }
  return undefined; // invalid
}

module.exports = {
  buildConfigButtons,
  buildConfigEmbed,
  parseColorInput,
};