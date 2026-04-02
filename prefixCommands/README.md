# Prefix Commands

Place tes commandes préfixe ici :

- `global/` — Commandes accessibles à tous (préfixe `PREFIX_GLOBAL`, par défaut `!`)
- `dev/` — Commandes réservées à l'owner/dev (préfixe `PREFIX_DEV`, par défaut `!!`)

Chaque fichier doit exporter un objet avec `name` et `execute({ client, message, args })`.

Exemple :
```js
module.exports = {
  name: "test",
  async execute({ client, message, args }) {
    await message.reply("Hello !");
  },
};
```
