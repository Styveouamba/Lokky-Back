# Système de Gamification pour Participants

## 🎯 Vue d'ensemble

Système de récompenses et classement pour les utilisateurs qui participent aux activités, même s'ils ne créent pas d'activités eux-mêmes.

## 📊 Métriques de participation

### Champs existants dans `reputation`
```typescript
{
  activitiesCompleted: number;    // Nombre d'activités complétées (présent)
  attendanceRate: number;         // Taux de présence (%)
  totalNoShows: number;           // Nombre d'absences
}
```

### Nouveaux champs à ajouter
```typescript
{
  participationStreak: number;    // Série d'activités consécutives
  longestStreak: number;          // Plus longue série
  categoriesExplored: string[];   // Catégories d'activités essayées
  socialScore: number;            // Score basé sur diversité et engagement
}
```

## 🏆 Classements pour participants

### 1. Super Participants
**Critère**: Nombre d'activités complétées
**Minimum**: Au moins 5 activités
**Badge**: 🎉 "Super Participant"

```typescript
sortCriteria = { 'reputation.activitiesCompleted': -1 };
minCriteria = { 'reputation.activitiesCompleted': { $gte: 5 } };
```

### 2. Toujours Présent
**Critère**: Taux de présence
**Minimum**: Au moins 10 activités ET taux > 90%
**Badge**: ⭐ "Toujours Présent"

```typescript
sortCriteria = { 'reputation.attendanceRate': -1 };
minCriteria = { 
  'reputation.activitiesCompleted': { $gte: 10 },
  'reputation.attendanceRate': { $gte: 90 }
};
```

### 3. Explorateurs
**Critère**: Nombre de catégories différentes essayées
**Minimum**: Au moins 5 catégories
**Badge**: 🌍 "Explorateur"

```typescript
sortCriteria = { 'reputation.categoriesExplored': -1 };
minCriteria = { 
  $expr: { $gte: [{ $size: '$reputation.categoriesExplored' }, 5] }
};
```

### 4. Série Incroyable
**Critère**: Plus longue série d'activités consécutives
**Minimum**: Au moins 5 activités d'affilée
**Badge**: 🔥 "En Feu"

```typescript
sortCriteria = { 'reputation.longestStreak': -1 };
minCriteria = { 'reputation.longestStreak': { $gte: 5 } };
```

## 🎖️ Niveaux de participation

### Bronze (1-10 activités)
- Badge: 🥉 "Débutant"
- Avantage: Accès aux activités publiques

### Argent (11-25 activités)
- Badge: 🥈 "Habitué"
- Avantage: Priorité dans les inscriptions

### Or (26-50 activités)
- Badge: 🥇 "Vétéran"
- Avantage: Peut suggérer des activités

### Platine (51-100 activités)
- Badge: 💎 "Expert"
- Avantage: Accès anticipé aux nouvelles activités

### Diamant (100+ activités)
- Badge: 💠 "Légende"
- Avantage: Badge vérifié + mise en avant

## 🔄 Mise à jour automatique

### Lors de la soumission d'un avis

```typescript
// Dans reviewController.ts - fonction updateUserAttendance()

if (wasPresent) {
  // 1. Incrémenter activitiesCompleted
  await User.findByIdAndUpdate(userId, {
    $inc: { 'reputation.activitiesCompleted': 1 }
  });

  // 2. Ajouter la catégorie si nouvelle
  const activity = await Activity.findById(activityId);
  await User.findByIdAndUpdate(userId, {
    $addToSet: { 'reputation.categoriesExplored': activity.category }
  });

  // 3. Mettre à jour la série
  await updateParticipationStreak(userId, activity.date);

  // 4. Calculer le score social
  await updateSocialScore(userId);

  // 5. Vérifier les nouveaux badges
  const newBadges = await checkParticipantBadges(userId);
  
  // 6. Envoyer notification si nouveau badge
  if (newBadges.length > 0) {
    await notifyNewBadges(userId, newBadges);
  }
}
```

## 📈 Calcul du score social

Le score social combine plusieurs facteurs:

```typescript
function calculateSocialScore(user: IUser): number {
  let score = 0;

  // Base: activités complétées (max 500 points)
  score += Math.min(user.reputation.activitiesCompleted * 5, 500);

  // Bonus: taux de présence (max 200 points)
  score += (user.reputation.attendanceRate / 100) * 200;

  // Bonus: diversité (max 150 points)
  score += user.reputation.categoriesExplored.length * 30;

  // Bonus: série actuelle (max 100 points)
  score += Math.min(user.reputation.participationStreak * 10, 100);

  // Bonus: longue série (max 50 points)
  score += Math.min(user.reputation.longestStreak * 5, 50);

  // Pénalité: absences (-10 points par absence)
  score -= user.reputation.totalNoShows * 10;

  return Math.max(0, score); // Minimum 0
}
```

## 🎁 Récompenses et badges

### Badges de participation

| Badge | Condition | Récompense |
|-------|-----------|------------|
| 🎉 Premier Pas | 1ère activité complétée | Déblocage profil |
| 🌟 Régulier | 10 activités | Badge sur profil |
| 🔥 En Feu | 5 activités d'affilée | Notification spéciale |
| 🌍 Explorateur | 5 catégories | Recommandations variées |
| ⭐ Fiable | 95% présence + 20 activités | Badge vérifié |
| 💎 VIP | 100 activités | Accès VIP |

### Notifications de progression

```typescript
// Exemples de notifications

// Nouveau niveau
"🎉 Niveau Argent atteint!"
"Vous avez complété 15 activités. Continuez comme ça!"

// Nouvelle série
"🔥 Série de 5 activités!"
"Vous êtes en feu! Continuez votre série."

// Nouvelle catégorie
"🌍 Nouvelle catégorie explorée!"
"Vous avez essayé 'Sport'. Découvrez-en d'autres!"

// Taux de présence élevé
"⭐ Participant fiable!"
"Votre taux de présence est de 98%. Impressionnant!"
```

## 🔔 Notifications push

### Quand envoyer

1. **Nouveau badge débloqué**
   - Immédiatement après validation de présence
   - Si conditions remplies

2. **Changement de niveau**
   - Passage Bronze → Argent → Or → Platine → Diamant
   - Notification avec animation spéciale

3. **Série en danger**
   - Si série active > 5 et pas d'activité depuis 7 jours
   - "🔥 Votre série de 8 activités est en danger!"

4. **Entrée dans le classement**
   - Top 10 des participants
   - Top 10 du taux de présence

## 📊 Endpoint API

### GET /users/participant-stats
Récupère les statistiques de participation

```typescript
{
  activitiesCompleted: 45,
  attendanceRate: 96,
  participationStreak: 3,
  longestStreak: 12,
  categoriesExplored: ["sport", "culture", "food"],
  socialScore: 785,
  level: "gold",
  badges: ["regular", "explorer", "reliable"],
  rank: {
    participants: 15,
    attendance: 8
  }
}
```

### GET /leaderboard?type=participants
Classement des meilleurs participants

```typescript
{
  leaderboard: [
    {
      _id: "123",
      name: "Alice",
      avatar: "...",
      reputation: {
        activitiesCompleted: 87,
        attendanceRate: 98,
        socialScore: 1250
      },
      badges: ["vip", "reliable", "explorer"]
    },
    ...
  ],
  myRank: 15,
  type: "participants"
}
```

## 🎮 Gamification avancée

### Défis hebdomadaires

```typescript
{
  weeklyChallenge: {
    title: "Explorateur de la semaine",
    description: "Participer à 3 catégories différentes",
    progress: 2,
    target: 3,
    reward: "Badge Explorateur + 50 points",
    expiresAt: "2024-01-15T23:59:59Z"
  }
}
```

### Système de points

- **Participation**: +10 points
- **Présence confirmée**: +5 points bonus
- **Nouvelle catégorie**: +20 points
- **Série de 5**: +50 points
- **Série de 10**: +100 points
- **Absence**: -20 points

### Utilisation des points

- Débloquer badges spéciaux
- Accès anticipé aux activités populaires
- Priorité dans les inscriptions
- Réductions futures (si monétisation)

## 🔧 Implémentation technique

### 1. Mise à jour du modèle User

```typescript
// Ajouter dans userModel.ts
reputation: {
  // ... champs existants
  participationStreak: { type: Number, default: 0 },
  longestStreak: { type: Number, default: 0 },
  categoriesExplored: [{ type: String }],
  socialScore: { type: Number, default: 0 },
  badges: [{ type: String }],
  level: { 
    type: String, 
    enum: ['bronze', 'silver', 'gold', 'platinum', 'diamond'],
    default: 'bronze'
  }
}
```

### 2. Service de gamification

```typescript
// services/participantGamificationService.ts

export async function updateParticipantStats(
  userId: string,
  activityId: string,
  wasPresent: boolean
): Promise<void> {
  if (!wasPresent) return;

  const user = await User.findById(userId);
  const activity = await Activity.findById(activityId);

  // Mettre à jour les stats
  await updateCategoriesExplored(user, activity.category);
  await updateParticipationStreak(user, activity.date);
  await updateSocialScore(user);
  await updateLevel(user);

  // Vérifier les badges
  const newBadges = await checkNewBadges(user);
  if (newBadges.length > 0) {
    await awardBadges(user, newBadges);
    await notifyNewBadges(user, newBadges);
  }
}
```

### 3. Intégration dans reviewController

```typescript
// Dans createReview après updateUserAttendance
if (wasPresent) {
  await updateParticipantStats(req.userId!, activityId, true);
}
```

## 📱 Interface utilisateur

### Page profil - Section Participation

```
┌─────────────────────────────────┐
│ 🎉 Votre Participation          │
├─────────────────────────────────┤
│ Niveau: 🥇 Or                   │
│ Score Social: 785 pts           │
│                                 │
│ 📊 Statistiques                 │
│ • 45 activités complétées       │
│ • 96% taux de présence          │
│ • 🔥 Série: 3 activités         │
│ • 🌍 6 catégories explorées     │
│                                 │
│ 🎖️ Badges (4)                   │
│ [🌟] [🔥] [🌍] [⭐]            │
│                                 │
│ 📈 Classements                  │
│ • #15 Meilleurs Participants    │
│ • #8 Taux de Présence          │
└─────────────────────────────────┘
```

## 🚀 Prochaines étapes

1. ✅ Système de base (activitiesCompleted, attendanceRate)
2. ⏳ Ajout des nouveaux champs au modèle
3. ⏳ Service de gamification des participants
4. ⏳ Endpoints API pour stats et classements
5. ⏳ Notifications de badges et niveaux
6. ⏳ Interface utilisateur
7. ⏳ Défis hebdomadaires
8. ⏳ Système de points échangeables
