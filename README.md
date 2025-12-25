# Discord Bot Template (FULL) — discord.js v14

Template **complet et prêt à l’emploi** pour créer un bot Discord moderne avec **discord.js v14**.  
Pensé pour démarrer vite, proprement, et servir de base solide pour des bots avancés.

---

## ✨ Fonctionnalités

- Slash Commands
- Handlers (commands & events)
- Tous les Gateway Intents
- Tous les Partials
- Prefix commands (optionnel)
  - Global (`!`)
  - Dev / Owner (`!!`)
- Configuration via `.env`
- Déploiement des slash commands
- Compatible PM2
- Structure claire et scalable

---

## 0) Prérequis

### Node.js
- Version **18+** (recommandé **20+**)

Vérifier l’installation :
```bash
node -v
npm -v
1) Récupérer le projet
ZIP
Télécharger le ZIP

Dézipper

Ouvrir un terminal dans le dossier

Git
bash
Copier le code
git clone <url-du-repo>
cd <nom-du-repo>
```
## 2) Installer les dépendances
bash
Copier le code
npm install
Cette commande installe automatiquement :

discord.js

dotenv

toutes les dépendances listées dans package.json

3) Configuration du .env
Créer le fichier
```bash
Copier le code
cp .env.example .env
Remplir le fichier
env
Copier le code
DISCORD_TOKEN=TON_TOKEN_ICI
CLIENT_ID=TON_CLIENT_ID_ICI
GUILD_ID=TON_GUILD_ID_TEST

PREFIX_GLOBAL=!
PREFIX_DEV=!!

OWNER_ID=TON_ID_DISCORD
NODE_ENV=development
Champs
Obligatoires : DISCORD_TOKEN, CLIENT_ID

Recommandé : GUILD_ID

Optionnels : OWNER_ID, prefix
```

## 4) Discord Developer Portal
Créer l’application
New Application

Donner un nom

Récupérer le CLIENT_ID
OAuth2 / General Information

Copier Client ID

Coller dans .env

Créer le bot
Onglet Bot

Add Bot

Reset Token

Copier le token dans .env

⚠️ Ne jamais partager ou commit le token

## 5) Activer les Privileged Gateway Intents
Dans Bot → Privileged Gateway Intents :

SERVER MEMBERS INTENT

PRESENCE INTENT

MESSAGE CONTENT INTENT

⚠️ Obligatoire (le template utilise tous les intents)

## 6) Inviter le bot sur le serveur
Activer le mode développeur
Discord → Paramètres → Avancé → Mode développeur

Récupérer le GUILD_ID
Clic droit sur le serveur → Copier l’ID

Mettre dans .env

Générer l’invitation
OAuth2 → URL Generator

Scopes

bot

applications.commands

Permissions

Administrator (pour tester)

## 7) Déployer les Slash Commands
```bash
Copier le code
npm run deploy
```
Avec GUILD_ID → instant

Sans GUILD_ID → global (plus lent)

## 8) Lancer le bot
```bash
Copier le code
npm start
Tester sur Discord :

Copier le code
/ping
```
## 9) Mode développement
```bash
Copier le code
npm run dev
Relance automatique du bot lors des modifications.
```
## 10) Production avec PM2 (optionnel)
```bash
Installer PM2
bash
Copier le code
npm i -g pm2
Lancer
bash
Copier le code
pm2 start index.js --name discord-bot
pm2 logs discord-bot
Auto-start
bash
Copier le code
pm2 startup
pm2 save
```
### 11) Structure du projet
```bash
Copier le code
.
├── index.js
├── deploycommands.js
├── commands/
│   └── utility/
├── events/
├── prefixCommands/
│   ├── global/
│   └── dev/
├── src/
│   ├── handlers/
│   └── utils/
├── modules/
├── .env.example
└── package.json
```
## 12) Où ajouter ton code
```bash
Slash commands : commands/<categorie>/

Events : events/

Prefix commands :

Global : prefixCommands/global

Dev : prefixCommands/dev

Gros systèmes : modules/
```

## 13) Problèmes fréquents
```bash
DISCORD_TOKEN manquant
.env absent ou incorrect

Slash commands invisibles
npm run deploy non exécuté

GUILD_ID absent

Missing permissions
Bot mal invité

Intents bloqués
Privileged Intents non activés
```

### 14) Commandes utiles

```bash
Copier le code
npm install
npm run deploy
npm start
npm run dev
```
🚀 Prêt à développer
Template prêt pour :

tickets

economy

logs

moderation

systèmes avancés