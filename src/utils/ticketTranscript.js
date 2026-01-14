// src/utils/ticketTranscript.js
// Transcript simple (TXT) sans librairie externe.

const { Buffer } = require("node:buffer");

async function fetchAllMessagesText(channel, { limit = 1000 } = {}) {
  const lines = [];

  // Discord fetch : 100 par page
  let lastId = undefined;
  let fetchedTotal = 0;

  while (fetchedTotal < limit) {
    const batch = await channel.messages.fetch({ limit: 100, before: lastId });
    if (!batch?.size) break;

    const arr = [...batch.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    for (const m of arr) {
      fetchedTotal++;
      const ts = new Date(m.createdTimestamp).toISOString();
      const author = `${m.author?.tag || m.author?.id || "unknown"}`;
      const content = (m.content || "").replace(/\r\n/g, "\n");
      const attach = m.attachments?.size
        ? ` [attachments: ${[...m.attachments.values()].map((a) => a.url).join(" ")}]`
        : "";
      const embedNote = m.embeds?.length ? ` [embeds: ${m.embeds.length}]` : "";
      lines.push(`[${ts}] ${author}: ${content}${attach}${embedNote}`.trim());
    }

    lastId = arr[0]?.id; // oldest in this batch
    if (batch.size < 100) break;
  }

  return lines.join("\n");
}

async function buildTranscriptAttachment(channel, filenameBase = "transcript") {
  const text = await fetchAllMessagesText(channel, { limit: 5000 });
  const buf = Buffer.from(text || "(vide)", "utf8");
  return { attachment: buf, name: `${filenameBase}.txt` };
}

module.exports = { buildTranscriptAttachment };
