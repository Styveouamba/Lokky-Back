# Optimisations de Performance

Ce document décrit les optimisations de performance mises en place pour permettre le scaling de l'application.

## 1. Index MongoDB

### Index Composés pour les Activités
Les index suivants ont été créés pour optimiser les requêtes les plus fréquentes:

```javascript
// Pagination avec curseur
{ status: 1, date: 1, _id: 1 }

// Recherche géographique
{ location: '2dsphere', status: 1 }

// Filtrage par tags
{ tags: 1, status: 1, date: 1 }

// Filtrage par catégorie
{ category: 1, status: 1, date: 1 }

// Activités d'un utilisateur
{ createdBy: 1, status: 1, date: -1 }

// Tri par fraîcheur
{ status: 1, createdAt: -1 }

// Participations
{ participants: 1, status: 1 }
```

### Index pour les Utilisateurs
```javascript
{ email: 1 } // unique
{ location: '2dsphere' }
{ interests: 1 }
{ goals: 1 }
{ lastActive: -1 } // Pour le pré-calcul des rankings
```

## 2. Pagination avec Curseur

Au lieu d'utiliser `skip()` et `limit()` (qui devient lent avec beaucoup de données), nous utilisons la pagination par curseur:

```javascript
// Requête avec curseur
GET /api/activities?limit=20&cursor=507f1f77bcf86cd799439011

// Réponse
{
  "activities": [...],
  "hasNextPage": true,
  "nextCursor": "507f1f77bcf86cd799439012"
}
```

### Avantages
- Performance constante même avec des millions d'enregistrements
- Pas de problème de "page drift" (données qui changent entre les pages)
- Utilise l'index `_id` qui est toujours présent

## 3. Cache Redis

### Architecture
- **Service**: `cacheService.ts` - Gestion de la connexion Redis
- **Service**: `rankingCacheService.ts` - Cache spécifique aux rankings
- **TTL**: 5 minutes par défaut

### Clés de Cache
```
ranking:user:{userId}        // Scores pour un utilisateur
ranking:activity:{activityId} // Scores pour une activité
```

### Invalidation
Le cache est invalidé automatiquement quand:
- Une activité est créée
- Une activité est modifiée
- Une activité est supprimée
- Un utilisateur rejoint/quitte une activité

### Fonctionnement Sans Redis
L'application fonctionne normalement sans Redis. Si Redis n'est pas disponible:
- Les rankings sont calculés à la volée
- Aucune erreur n'est levée
- Un message de warning est affiché au démarrage

## 4. Pré-calcul des Rankings

### Scheduler
Un job s'exécute toutes les 5 minutes pour pré-calculer les rankings des utilisateurs actifs:

```javascript
// Toutes les 5 minutes
await rankingCacheService.precomputeRankings();
```

### Critères d'Utilisateurs Actifs
- Connectés dans les dernières 24h
- Ont une localisation définie

### Traitement par Batch
- Traite 100 utilisateurs à la fois
- Évite la surcharge mémoire
- Permet le scaling horizontal

## 5. Optimisations des Requêtes

### Utilisation de `.lean()`
Pour les requêtes en lecture seule, nous utilisons `.lean()` pour obtenir des objets JavaScript simples au lieu de documents Mongoose:

```javascript
const activities = await Activity.find(query)
  .lean() // 5-10x plus rapide
  .limit(20);
```

### Projection des Champs
Nous ne récupérons que les champs nécessaires:

```javascript
const user = await User.findById(userId)
  .select('interests goals location') // Seulement ces champs
  .lean();
```

## 6. Métriques et Monitoring

### Logs de Performance
```javascript
console.log('[RankingCache] Cache hit for user ${userId}');
console.log('[RankingCache] Cache miss for user ${userId}, computing...');
```

### Métriques à Surveiller
- Taux de hit du cache Redis
- Temps de réponse des endpoints `/activities`
- Nombre d'utilisateurs actifs traités par le scheduler
- Taille de la base de données MongoDB

## 7. Configuration

### Variables d'Environnement
```bash
# Redis (optionnel)
REDIS_URL=redis://localhost:6379

# Pour Docker
REDIS_URL=redis://redis:6379

# Pour Redis Cloud
REDIS_URL=redis://username:password@host:port
```

### Docker Compose
Pour ajouter Redis au stack Docker:

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

volumes:
  redis_data:
```

## 8. Scaling Horizontal

### Stratégies
1. **Load Balancer**: Nginx ou AWS ALB devant plusieurs instances Node.js
2. **Redis Cluster**: Pour distribuer le cache
3. **MongoDB Replica Set**: Pour la haute disponibilité
4. **Séparation des Services**: 
   - API principale
   - Service de ranking (workers)
   - Service de notifications

### Exemple d'Architecture Scalable
```
                    ┌─────────────┐
                    │Load Balancer│
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼────┐       ┌────▼────┐       ┌────▼────┐
   │ Node.js │       │ Node.js │       │ Node.js │
   │Instance1│       │Instance2│       │Instance3│
   └────┬────┘       └────┬────┘       └────┬────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼────┐       ┌────▼────┐       ┌────▼────┐
   │  Redis  │       │ MongoDB │       │ Socket  │
   │ Cluster │       │ Replica │       │   IO    │
   └─────────┘       └─────────┘       └─────────┘
```

## 9. Tests de Performance

### Commandes Utiles
```bash
# Test de charge avec Apache Bench
ab -n 1000 -c 10 http://localhost:3000/api/activities

# Monitoring Redis
redis-cli INFO stats
redis-cli MONITOR

# Monitoring MongoDB
db.activities.stats()
db.activities.getIndexes()
```

### Objectifs de Performance
- Temps de réponse < 200ms pour `/activities` (avec cache)
- Temps de réponse < 500ms pour `/activities` (sans cache)
- Support de 1000+ requêtes/seconde avec 3 instances
- Taux de hit du cache > 80%

## 10. Maintenance

### Nettoyage du Cache
```bash
# Vider tout le cache
redis-cli FLUSHALL

# Vider seulement les rankings
redis-cli KEYS "ranking:*" | xargs redis-cli DEL
```

### Reconstruction des Index
```bash
# Dans MongoDB
db.activities.reIndex()
db.users.reIndex()
```

### Monitoring de la Santé
```bash
# Vérifier Redis
redis-cli PING

# Vérifier MongoDB
mongosh --eval "db.adminCommand('ping')"
```
