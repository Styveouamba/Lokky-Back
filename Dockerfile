FROM node:20-alpine

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances
RUN npm ci --only=production && npm cache clean --force

# Copier le code source
COPY . .

# Build TypeScript
RUN npm run build

# Exposer le port
EXPOSE 3000

# Démarrer l'application
CMD ["npm", "start"]
