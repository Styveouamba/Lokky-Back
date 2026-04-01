# Implémentation du Système de Confiance - Backend

## Modifications du Modèle User

Ajouter les champs suivants au modèle `userModel.ts` :

```typescript
// Champs de réputation à ajouter
rating: {
  type: Number,
  default: 0,
  min: 0,
  max: 5,
},
activityCount: {
  type: Number,
  default: 0,
},
reviewCount: {
  type: Number,
  default: 0,
},
participationRate: {
  type: Number,
  default: 0,
  min: 0,
  max: 100,
},
completionRate: {
  type: Number,
  default: 0,
  min: 0,
  max: 100,
},
```

## Nouveau Modèle : Review

Créer `Backend/src/models/reviewModel.ts` :

```typescript
import mongoose, { Schema,