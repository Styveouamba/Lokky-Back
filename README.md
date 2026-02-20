# Lokky Backend

Backend API pour l'application Lokky - Une app sociale locale pour connecter les gens autour d'activités réelles à Dakar.

## 🚀 Démarrage rapide avec Docker

### Prérequis
- Docker Desktop installé
- Docker Compose installé

### Lancer l'application

```bash
# Copier le fichier d'environnement
copy .env.example .env

# Éditer .env avec vos vraies valeurs (JWT_SECRET, Cloudinary, etc.)

# Démarrer tous les services
npm run docker:dev

# Ou avec rebuild
npm run docker:build
```

L'application sera disponible sur :
- Backend API: http://localhost:3000
- MongoDB: localhost:27017
- Mongo Express (UI): http://localhost:8081 (admin/admin123)

### Arrêter les services

```bash
# Arrêter
npm run docker:down

# Arrêter et supprimer les volumes (données)
npm run docker:clean
```

## 💻 Développement local (sans Docker)

### Installation

```bash
npm install
```

### Configuration

```bash
copy .env.example .env
```

Puis remplir les variables d'environnement.

### Développement

```bash
npm run dev
```

### Build

```bash
npm run build
npm start
```

## Routes API

### Auth
- `POST /api/users/register` - Inscription
- `POST /api/users/login` - Connexion
- `GET /api/users/profile` - Profil utilisateur (protégé)

### Activities
- `POST /api/activities` - Créer une activité (protégé)
- `GET /api/activities` - Liste des activités (protégé)
- `GET /api/activities/:id` - Détails d'une activité (protégé)
- `POST /api/activities/:id/join` - Rejoindre une activité (protégé)

### Groups
- `POST /api/groups` - Créer un groupe (protégé)
- `GET /api/groups` - Liste des groupes (protégé)
- `GET /api/groups/:id` - Détails d'un groupe (protégé)


## 📁 Structure du projet

```
Backend/
├─ src/
│   ├─ controllers/       # Logique métier
│   │   ├─ userController.ts
│   │   ├─ activityController.ts
│   │   └─ groupController.ts
│   ├─ models/            # Schémas MongoDB
│   │   ├─ userModel.ts
│   │   ├─ activityModel.ts
│   │   └─ groupModel.ts
│   ├─ routes/            # Routes Express
│   │   ├─ userRoutes.ts
│   │   ├─ activityRoutes.ts
│   │   └─ groupRoutes.ts
│   ├─ middleware/        # Middlewares
│   │   ├─ authMiddleware.ts
│   │   └─ errorHandler.ts
│   ├─ utils/             # Utilitaires
│   │   ├─ cloudinary.ts
│   │   └─ logger.ts
│   ├─ app.ts             # Config Express
│   └─ server.ts          # Point d'entrée
├─ Dockerfile             # Production
├─ Dockerfile.dev         # Développement
└─ docker-compose.yml     # Orchestration
```

## 🔌 Routes API

### Auth
- `POST /api/users/register` - Inscription (email/password)
- `POST /api/users/login` - Connexion
- `GET /api/users/profile` - Profil utilisateur (protégé)

### Activities
- `POST /api/activities` - Créer une activité (protégé)
- `GET /api/activities` - Liste des activités (protégé)
- `GET /api/activities/:id` - Détails d'une activité (protégé)
- `POST /api/activities/:id/join` - Rejoindre une activité (protégé)

### Groups
- `POST /api/groups` - Créer un groupe (protégé)
- `GET /api/groups` - Liste des groupes (protégé)
- `GET /api/groups/:id` - Détails d'un groupe (protégé)

## 🔐 Authentification

L'API utilise JWT pour l'authentification. Après login/register, incluez le token dans les requêtes :

```
Authorization: Bearer <token>
```

## 🌍 Variables d'environnement

Voir `.env.example` pour la liste complète des variables requises.

## 🐳 Docker

### Services
- `backend`: API Node.js/Express
- `mongo`: Base de données MongoDB
- `mongo-express`: Interface web pour MongoDB

### Volumes
- `mongo-data`: Persistance des données MongoDB

### Network
- `lokky-network`: Réseau bridge pour la communication inter-services
