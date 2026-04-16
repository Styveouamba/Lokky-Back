# 🔔 Système de Notifications Intelligentes

## Vue d'ensemble

Le système de notifications intelligentes envoie des notifications push personnalisées aux utilisateurs en fonction de leur localisation, leurs intérêts et leur comportement.

## Types de Notifications

### 1. 🎯 Notifications Géolocalisées

#### Nouvelle activité correspondant aux intérêts
**Déclencheur:** Quand une activité est créée
**Critères:**
- L'activité est dans un rayon de 25km de l'utilisateur
- La catégorie ou les tags correspondent aux intérêts de l'utilisateur
- L'utilisateur n'est pas le créateur

**Message:**
```
🎯 Nouvelle activité près de toi !
[Titre de l'activité] à [distance] - [Lieu]
```

**Implémentation:**
```typescript
// Appelé automatiquement lors de la création d'une activité
notifyNearbyUsersForNewActivity(activityId, maxDistanceKm = 25)
```

#### Activité populaire se remplissant rapidement
**Déclencheur:** Quand quelqu'un rejoint une activité
**Critères:**
- L'activité est remplie à 70% ou plus
- L'utilisateur est dans un rayon de 15km
- L'activité correspond aux intérêts de l'utilisateur
- L'utilisateur ne participe pas déjà

**Message:**
```
🔥 Activité populaire !
[Titre] - Plus que X places !
```

**Implémentation:**
```typescript
// Appelé automatiquement quand fillRate >= 70%
notifyPopularActivityFilling(activityId)
```

### 2. 🌟 Notifications de Découverte (Aléatoires)

Envoyées 1 fois par jour (18h) à 20% des utilisateurs actifs de façon aléatoire.

#### Nouvelle catégorie à explorer
**Critères:**
- Catégorie jamais explorée par l'utilisateur
- Activité dans un rayon de 20km
- Activité à venir

**Message:**
```
🌟 Découvre quelque chose de nouveau !
[Catégorie] : [Titre de l'activité]
```

#### Nouveau lieu à découvrir
**Critères:**
- Activité entre 10km et 25km de l'utilisateur
- Encourage l'exploration de nouveaux quartiers

**Message:**
```
🗺️ Explore un nouveau quartier !
[Titre] à [Lieu] (X km)
```

#### Créateur bien noté
**Critères:**
- Créateur avec note >= 4.5 étoiles
- Minimum 5 avis
- Activité correspondant aux intérêts
- Dans un rayon de 20km

**Message:**
```
⭐ Créateur 5 étoiles !
[Titre] par [Nom] (4.8⭐)
```

## Configuration

### Distances par défaut
- Nouvelles activités: **25 km**
- Activités populaires: **15 km**
- Découverte: **20 km** (10-25 km pour nouveaux lieux)

### Fréquence
- Notifications géolocalisées: **Temps réel** (à la création/participation)
- Notifications de découverte: **1x par jour** (18h)
- Pourcentage d'utilisateurs: **20%** (sélection aléatoire)

### Filtres
- Utilisateurs avec `pushToken` valide
- Utilisateurs avec `interests` définis
- Utilisateurs avec `location` définie
- Statut de modération: `active`

## Utilisation

### Automatique
Les notifications sont envoyées automatiquement:
- À la création d'une activité
- Quand une activité atteint 70% de remplissage
- 1 fois par jour (18h) pour les découvertes

### Manuel (Admin)
Pour tester les notifications de découverte:
```bash
POST /api/admin/test/discovery-notifications
Authorization: Bearer [admin-token]
```

## Données envoyées avec les notifications

Chaque notification inclut des métadonnées pour le deep linking:

```typescript
{
  type: 'new_activity_nearby' | 'popular_activity' | 'discovery_new_category' | 'discovery_new_location' | 'discovery_top_creator',
  activityId: string,
  distance?: number,
  category?: string,
  creatorRating?: number,
  spotsLeft?: number
}
```

## Logs

Les logs incluent:
- Nombre d'utilisateurs éligibles trouvés
- Nombre de notifications envoyées avec succès
- Erreurs éventuelles

Exemple:
```
[SmartNotification] Found 45 nearby users for activity 123abc
[SmartNotification] Sent 23 notifications for activity 123abc
[SmartNotification] Selected 150 users for discovery notifications
[SmartNotification] Sent 150 discovery notifications
```

## Optimisations

### Performance
- Requêtes géospatiales avec index `2dsphere`
- Notifications envoyées en arrière-plan (non-bloquant)
- Délai de 100ms entre chaque notification pour ne pas surcharger l'API Expo

### Anti-spam
- Sélection aléatoire de 20% des utilisateurs pour les découvertes
- Vérification des tokens push valides
- Suppression automatique des tokens invalides

## Améliorations futures

- [ ] Préférences utilisateur pour les types de notifications
- [ ] Fréquence personnalisable par utilisateur
- [ ] Historique des notifications envoyées
- [ ] A/B testing des messages
- [ ] Analytics sur les taux d'ouverture
- [ ] Notifications basées sur l'historique (ML)
