FROM node:20-alpine

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer toutes les dépendances (y compris dev pour le build)
RUN npm ci && npm cache clean --force

# Copier le code source
COPY . .

# Build TypeScript
RUN npm run build

# Supprimer les devDependencies après le build
RUN npm prune --production

# Exposer le port
EXPOSE 3000

# Démarrer l'application
CMD ["npm", "start"]
