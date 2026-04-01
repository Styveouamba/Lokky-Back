# Système de Notifications de Changement de Rang

## 🎯 Vue d'ensemble

Le système détecte automatiquement les changements de rang dans le leaderboard et envoie des notifications push personnalisées aux utilisateurs.

## 📱 Types de notifications

### 1. 🏆 Devenu Champion (#1)
**Trigger**: L'utilisateur passe de n'importe quel rang à la position #1

**Notification**:
```
Titre: "🏆 Félicitations Champion!"
Message: "Vous êtes maintenant #1 dans le classement [Catégorie]!"
```

**Exemple**: Un utilisateur passe de #3 à #1 dans "Top Créateurs"

---

### 2. ⭐ Entrée dans le Top 10
**Trigger**: L'utilisateur passe d'un rang > 10 à un rang ≤ 10

**Notification**:
```
Titre: "⭐ Top 10!"
Message: "Bravo! Vous êtes maintenant #[rang] dans le classement [Catégorie]!"
```

**Exemple**: Un utilisateur passe de #15 à #8 dans "Meilleures Notes"

---

### 3. 📈 Belle Progression
**Trigger**: L'utilisateur gagne 5 places ou plus

**Notification**:
```
Titre: "📈 Belle progression!"
Message: "Vous avez gagné [X] places! Vous êtes maintenant #[rang] dans [Catégorie]."
```

**Exemple**: Un utilisateur passe de #25 à #18 (gain de 7 places)

---

### 4. 💪 Encouragement
**Trigger**: L'utilisateur perd 5 places ou plus

**Notification**:
```
Titre: "💪 Continuez vos efforts!"
Message: "Votre rang a changé dans [Catégorie]. Créez plus d'activités pour remonter!"
```

**Exemple**: Un utilisateur passe de #12 à #18 (perte de 6 places)

---

## 🔄 Flux de détection

```
1. Utilisateur crée une activité
   ↓
2. Compteur reputation.activitiesCreated incrémenté
   ↓
3. Leaderboard recalculé (avec cache Redis)
   ↓
4. Comparaison avec rangs précédents (stockés dans Redis)
   ↓
5. Détection des changements significatifs
   ↓
6. Envoi des notifications push
   ↓
7. Sauvegarde des nouveaux rangs dans Redis
```

## 📊 Catégories de classement

### Top Créateurs (`creators`)
- **Critère**: Nombre d'activités créées
- **Minimum**: Au moins 1 activité créée
- **Tri**: Décroissant par `reputation.activitiesCreated`

### Meilleures Notes (`ratings`)
- **Critère**: Note moyenne en tant que créateur
- **Minimum**: Au moins 3 avis reçus
- **Tri**: Décroissant par `reputation.averageRating`, puis `totalReviews`

### Plus Actifs (`active`)
- **Critère**: Nombre d'activités complétées
- **Minimum**: Au moins 1 activité complétée
- **Tri**: Décroissant par `reputation.activitiesCompleted`

## 🗄️ Stockage Redis

### Structure des clés

```typescript
// Cache du leaderboard (TTL: 5 minutes)
leaderboard:creators → JSON array of rankings
leaderboard:ratings → JSON array of rankings
leaderboard:active → JSON array of rankings

// Historique des rangs (TTL: 24 heures)
user:{userId}:rank:creators → { rank, score, timestamp }
user:{userId}:rank:ratings → { rank, score, timestamp }
user:{userId}:rank:active → { rank, score, timestamp }
```

### Exemple de données

```json
// leaderboard:creators
[
  { "userId": "123", "rank": 1, "score": 45, "category": "creators" },
  { "userId": "456", "rank": 2, "score": 38, "category": "creators" },
  ...
]

// user:123:rank:creators
{
  "rank": 2,
  "score": 43,
  "timestamp": 1704067200000
}
```

## 🔧 Configuration

### Variables d'environnement

```env
# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password_here

# Cache TTL (en secondes)
LEADERBOARD_CACHE_TTL=300        # 5 minutes
RANK_HISTORY_TTL=86400           # 24 heures
```

### Docker Compose

```yaml
redis:
  image: redis:7-alpine
  container_name: lokky-redis
  ports:
    - "6379:6379"
  volumes:
    - redis-data:/data
  command: redis-server --appendonly yes
```

## 📝 Fichiers impliqués

### Backend

1. **`services/rankingCacheService.ts`**
   - Gestion du cache Redis
   - Détection des changements de rang
   - Sauvegarde de l'historique

2. **`services/rankNotificationService.ts`**
   - Création des notifications personnalisées
   - Envoi des push notifications
   - Gestion des différents types de changements

3. **`controllers/userController.ts`**
   - Endpoint `getLeaderboard`
   - Intégration du cache et des notifications
   - Calcul des rangs

### Frontend

Les notifications sont reçues automatiquement via Expo Notifications et affichées comme des toasts ou des modals selon le type.

## 🧪 Tests

### Test manuel

1. Créer plusieurs activités pour monter dans le classement
2. Vérifier la réception des notifications
3. Consulter les logs Redis pour voir les changements

### Commandes Redis utiles

```bash
# Voir toutes les clés
redis-cli KEYS "*"

# Voir un leaderboard
redis-cli GET leaderboard:creators

# Voir le rang d'un utilisateur
redis-cli GET user:123:rank:creators

# Vider le cache
redis-cli FLUSHDB
```

## 🐛 Dépannage

### Les notifications ne sont pas envoyées

1. Vérifier que Redis est démarré: `docker ps | grep redis`
2. Vérifier les logs: `docker logs lokky-redis`
3. Vérifier que l'utilisateur a un `expoPushToken`
4. Vérifier les logs backend pour les erreurs

### Le cache ne fonctionne pas

1. Vérifier la connexion Redis dans les logs
2. Tester la connexion: `redis-cli PING` (doit retourner PONG)
3. Vérifier les variables d'environnement

### Les rangs ne sont pas corrects

1. Invalider le cache: `redis-cli FLUSHDB`
2. Redémarrer le backend
3. Recharger le leaderboard

## 📈 Métriques

Le système track automatiquement:
- Nombre de changements de rang détectés
- Nombre de notifications envoyées
- Taux de cache hit/miss
- Temps de réponse du leaderboard

Accès aux stats via:
```typescript
const stats = await rankingCacheService.getCacheStats();
// { hits: 150, misses: 25, keys: 6 }
```

## 🚀 Améliorations futures

- [ ] Notifications groupées (digest quotidien)
- [ ] Préférences utilisateur (désactiver certaines notifs)
- [ ] Historique complet des rangs (graphique)
- [ ] Notifications in-app en plus des push
- [ ] Système de badges pour les achievements
