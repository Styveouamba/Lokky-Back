# Configuration Admin Lokky

## Utilisateur Admin par défaut

Au démarrage du serveur, un utilisateur admin est automatiquement créé s'il n'existe pas déjà.

### Identifiants par défaut

```
Email: admin@lokky.com
Mot de passe: Admin@Lokky2024
```

⚠️ **IMPORTANT**: Changez ces identifiants après la première connexion!

## Configuration personnalisée

Vous pouvez personnaliser les identifiants admin via les variables d'environnement dans le fichier `.env`:

```env
ADMIN_EMAIL=votre-email@example.com
ADMIN_PASSWORD=VotreMotDePasseSecurise
ADMIN_NAME=Votre Nom
```

## Endpoints API Admin

Tous les endpoints admin nécessitent:
1. Un token JWT valide (header `Authorization: Bearer <token>`)
2. Le rôle `admin`

### Statistiques

```
GET /api/admin/stats
```

Retourne les statistiques du dashboard:
- Nombre total d'utilisateurs
- Utilisateurs actifs
- Nombre total d'activités
- Activités actives
- Nombre total de signalements
- Signalements en attente

### Gestion des utilisateurs

```
GET /api/admin/users?page=1&limit=20&search=john
```

Liste tous les utilisateurs avec pagination et recherche.

```
PATCH /api/admin/users/:userId/suspend
Body: { duration: 7, reason: "Comportement inapproprié" }
```

Suspend un utilisateur pour X jours.

```
PATCH /api/admin/users/:userId/ban
```

Bannit définitivement un utilisateur.

```
PATCH /api/admin/users/:userId/reactivate
```

Réactive un utilisateur suspendu ou banni.

### Gestion des activités

```
GET /api/admin/activities?page=1&limit=20&status=upcoming
```

Liste toutes les activités avec pagination et filtrage par statut.

```
DELETE /api/admin/activities/:activityId
```

Supprime une activité.

### Gestion des signalements

```
GET /api/admin/reports?page=1&limit=20&status=pending
```

Liste tous les signalements avec pagination et filtrage par statut.

```
PATCH /api/admin/reports/:reportId/process
Body: { 
  status: "resolved", 
  action: "warn" | "suspend" | "ban" | "dismiss" 
}
```

Traite un signalement et applique une action sur l'utilisateur signalé.

## Rôles

Le système supporte deux rôles:
- `user`: Utilisateur normal (par défaut)
- `admin`: Administrateur avec accès complet

## Sécurité

- Les mots de passe sont hashés avec bcrypt
- Les tokens JWT expirent après 7 jours
- Toutes les routes admin sont protégées par le middleware `isAdmin`
- Les actions admin sont loggées

## Connexion au Dashboard

1. Démarrez le backend: `npm run dev`
2. Démarrez le dashboard admin: `cd Admin && npm run dev`
3. Accédez à `http://localhost:5173`
4. Connectez-vous avec les identifiants admin

## Développement

Pour tester les endpoints admin en développement, utilisez un outil comme Postman ou curl:

```bash
# 1. Se connecter
curl -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@lokky.com","password":"Admin@Lokky2024"}'

# 2. Utiliser le token reçu
curl -X GET http://localhost:3000/api/admin/stats \
  -H "Authorization: Bearer <votre-token>"
```
