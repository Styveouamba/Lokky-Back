# Système de Réputation et Gamification

## 🎯 Vue d'ensemble

Le système de réputation suit automatiquement les statistiques des utilisateurs pour alimenter le leaderboard et encourager l'engagement.

## 📊 Champs de réputation (User Model)

```typescript
reputation: {
  averageRating: number;        // Note moyenne en tant que créateur (0-5)
  totalReviews: number;         // Nombre total d'avis reçus
  activitiesCreated: number;    // Nombre d'activités créées
  activitiesCompleted: number;  // Nombre d'activités complétées
  attendanceRate: number;       // Taux de présence (%)
  totalNoShows: number;         // Nombre de fois absent
}
```

## 🔄 Mise à jour automatique

### Création d'activité
**Fichier**: `Backend/src/controllers/activityController.ts`

Lors de la création d'une activité:
```typescript
await User.findByIdAndUpdate(
  req.userId,
  { $inc: { 'reputation.activitiesCreated': 1 } }
);
```

### Participation à une activité
**À implémenter**: Incrémenter `activitiesCompleted` quand l'activité est terminée

### Notes et avis
**À implémenter**: Mettre à jour `averageRating` et `totalReviews` après chaque avis

### Présence
**À implémenter**: Mettre à jour `attendanceRate` et `totalNoShows` selon la présence

## 🔧 Script de synchronisation

**Fichier**: `Backend/update-reputation-counters.js`

Utiliser ce script pour synchroniser les compteurs avec les données existantes:

```bash
node update-reputation-counters.js
```

Ce script:
- Compte toutes les activités créées par chaque utilisateur
- Compte toutes les activités complétées
- Met à jour les compteurs dans la base de données

## 📱 Frontend - Rafraîchissement du profil

**Fichier**: `Frontend/app/(tabs)/create.tsx`

Après la création d'une activité, le profil est automatiquement rafraîchi:

```typescript
const profileResponse = await fetch(`${API_URL}/users/profile`, {
  headers: { 'Authorization': `Bearer ${token}` },
});
if (profileResponse.ok) {
  const profileData = await profileResponse.json();
  useAuthStore.getState().setUser(profileData.user);
}
```

## 🏆 Leaderboard

Le leaderboard utilise ces compteurs pour classer les utilisateurs:

### Top Créateurs
```typescript
sortCriteria = { 'reputation.activitiesCreated': -1 };
minCriteria = { 'reputation.activitiesCreated': { $gt: 0 } };
```

### Meilleures Notes
```typescript
sortCriteria = { 'reputation.averageRating': -1, 'reputation.totalReviews': -1 };
minCriteria = { 'reputation.totalReviews': { $gte: 3 } };
```

### Plus Actifs
```typescript
sortCriteria = { 'reputation.activitiesCompleted': -1 };
minCriteria = { 'reputation.activitiesCompleted': { $gt: 0 } };
```

## ✅ Checklist d'implémentation

### ✅ Fonctionnalités implémentées

- [x] **Compteur `activitiesCreated`** - Incrémenté automatiquement à la création d'activité
  - Fichier: `Backend/src/controllers/activityController.ts`
  - Ligne: `await User.findByIdAndUpdate(req.userId, { $inc: { 'reputation.activitiesCreated': 1 } })`

- [x] **Compteur `activitiesCompleted`** - Mis à jour lors de la soumission d'un avis
  - Fichier: `Backend/src/controllers/reviewController.ts`
  - Fonction: `updateUserAttendance()` - Compte les activités où l'utilisateur était présent

- [x] **Mise à jour `averageRating`** - Recalculé après chaque avis
  - Fichier: `Backend/src/controllers/reviewController.ts`
  - Fonction: `updateUserReputation()` - Calcule la moyenne de tous les avis reçus

- [x] **Calcul `attendanceRate`** - Basé sur la présence déclarée dans les avis
  - Fichier: `Backend/src/controllers/reviewController.ts`
  - Fonction: `updateUserAttendance()` - Calcule le pourcentage de présence

- [x] **Incrémentation `totalNoShows`** - Comptabilisé en cas d'absence
  - Fichier: `Backend/src/controllers/reviewController.ts`
  - Fonction: `updateUserAttendance()` - Compte les absences déclarées

- [x] **Script de synchronisation** - Pour mettre à jour les données existantes
  - Fichier: `Backend/update-reputation-counters.js`

- [x] **Rafraîchissement automatique du profil** - Après création d'activité
  - Fichier: `Frontend/app/(tabs)/create.tsx`

- [x] **Endpoint leaderboard** - Classement par différents critères
  - Fichier: `Backend/src/services/rankingService.ts`

- [x] **Notifications de complétion** - Envoyées 1h après la fin d'activité
  - Fichier: `Backend/src/services/activityLifecycleService.ts`
  - Fonction: `notifyActivityCompleted()`

- [x] **Invalidation du cache** - Après suppression d'activité
  - Fichier: `Frontend/stores/activityStore.ts`
  - Fonction: `invalidateCache()`

### 📋 Détails d'implémentation

#### Système d'avis (Reviews)
Le système d'avis met automatiquement à jour toutes les statistiques de réputation:

```typescript
// Lors de la création d'un avis
await createReview({
  activityId,
  activityRating,    // Note de l'activité (1-5)
  creatorRating,     // Note du créateur (1-5)
  wasPresent,        // Présence (true/false)
  comment            // Commentaire optionnel
});

// Mises à jour automatiques:
// 1. averageRating et totalReviews du créateur
// 2. activitiesCompleted du participant
// 3. attendanceRate du participant
// 4. totalNoShows du participant
```

#### Cycle de vie des activités
Les activités passent automatiquement par différents statuts:

1. **upcoming** - Activité à venir
2. **ongoing** - Activité en cours (date passée, pas encore terminée)
3. **completed** - Activité terminée (date + durée passées)
4. **cancelled** - Activité annulée

Le statut est calculé dynamiquement dans `activityLifecycleService.ts`

## 🔮 Améliorations futures

### 🚀 Court terme (Prochaines itérations)

- [ ] **Webhook temps réel** - Mettre à jour les compteurs via WebSocket
  - Notifier instantanément les changements de réputation
  - Synchroniser le leaderboard en temps réel

- [ ] **Cache Redis** - Optimiser les performances du leaderboard
  - Réduire la charge sur MongoDB
  - Temps de réponse < 50ms

- [ ] **Notifications push** - Alertes pour changements de rang
  - "Vous êtes maintenant dans le top 10!"
  - "Nouveau badge débloqué!"

- [ ] **Historique de progression** - Graphiques d'évolution
  - Courbe de réputation sur 30 jours
  - Comparaison avec la moyenne

### 🎯 Moyen terme (1-3 mois)

- [ ] **Système de badges** - Récompenses visuelles
  - Badge "Créateur Légendaire" (100+ activités)
  - Badge "Toujours Présent" (100% présence)
  - Badge "5 Étoiles" (note moyenne > 4.8)
  - Badge "Pionnier" (parmi les premiers utilisateurs)

- [ ] **Profil détaillé** - Statistiques avancées
  - Graphiques de progression
  - Historique des activités
  - Comparaison avec d'autres utilisateurs

- [ ] **Système de niveaux** - Progression gamifiée
  - Bronze (0-10 activités)
  - Argent (11-25 activités)
  - Or (26-50 activités)
  - Platine (51-100 activités)
  - Diamant (100+ activités)

- [ ] **Achievements** - Objectifs à débloquer
  - "Première activité créée"
  - "10 activités complétées"
  - "Note parfaite sur 10 activités"
  - "Organisateur du mois"

### 🌟 Long terme (3-6 mois)

- [ ] **Saisons de classement** - Reset périodique
  - Classement mensuel/trimestriel
  - Récompenses de fin de saison
  - Hall of Fame des champions

- [ ] **Récompenses tangibles** - Avantages réels
  - Activités sponsorisées pour top performers
  - Accès anticipé aux nouvelles fonctionnalités
  - Badge vérifié sur le profil

- [ ] **Système de parrainage** - Bonus pour invitations
  - Points bonus pour chaque ami invité
  - Récompenses pour parrains actifs

- [ ] **Classement par catégories** - Spécialisation
  - Top créateur Sport
  - Top créateur Culture
  - Top créateur Soirée

- [ ] **Système de réputation sociale** - Influence
  - Score d'influence basé sur l'engagement
  - Recommandations personnalisées
  - Mise en avant des créateurs influents

## 🐛 Dépannage

### Les compteurs ne se mettent pas à jour
1. Vérifier que le backend est redémarré après modification
2. Exécuter le script de synchronisation
3. Vérifier les logs du backend pour les erreurs

### Le leaderboard est vide
1. Vérifier que des utilisateurs ont créé des activités
2. Vérifier les critères minimums (ex: 3 avis pour les notes)
3. Vérifier que les utilisateurs ne sont pas bannis

### Le profil n'affiche pas les bonnes stats
1. Forcer le rafraîchissement de l'app
2. Se déconnecter et se reconnecter
3. Vérifier que le token est valide
