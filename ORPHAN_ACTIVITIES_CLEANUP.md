# Nettoyage des Activités Orphelines

## Problème
Lorsqu'un utilisateur supprime son compte, ses activités restaient dans la base de données avec un `createdBy` qui pointait vers un utilisateur inexistant. Cela causait des erreurs `Cannot read property '_id' of null` dans le frontend.

## Solution Implémentée

### 1. Suppression Automatique lors de la Suppression de Compte
Quand un utilisateur supprime son compte (`DELETE /api/users/delete-account`), toutes ses activités sont maintenant automatiquement supprimées.

**Fichier:** `src/controllers/userController.ts`
```typescript
// Supprimer TOUTES les activités créées par cet utilisateur
const Activity = (await import('../models/activityModel')).default;
const deletedActivities = await Activity.deleteMany({ createdBy: userId });
```

### 2. Filtrage des Activités Orphelines dans les Endpoints
Tous les endpoints qui retournent des activités filtrent maintenant les activités dont le créateur est `null` :

**Fichiers modifiés:**
- `src/controllers/activityController.ts`
  - `getActivities()` - Liste paginée
  - `getActivityById()` - Détails d'une activité
  - `getRecommendedActivities()` - Recommandations
  - `getTrendingActivities()` - Tendances
  - `getMyActivities()` - Mes activités

**Exemple:**
```typescript
// Filtrer les activités dont le créateur a été supprimé
activities = activities.filter(activity => activity.createdBy !== null);
```

### 3. Script de Nettoyage Manuel
Un script a été créé pour nettoyer les activités orphelines existantes.

**Fichier:** `src/scripts/cleanOrphanActivities.ts`

**Utilisation:**

#### Via l'API Admin (recommandé)
```bash
POST /api/admin/cleanup/orphan-activities
Authorization: Bearer <admin-token>
```

#### Via la ligne de commande
```bash
cd Backend
npx ts-node src/scripts/cleanOrphanActivities.ts
```

## Prévention Future

### Cascade Delete (Optionnel)
Pour une solution plus robuste, vous pouvez ajouter un middleware Mongoose qui supprime automatiquement les activités quand un utilisateur est supprimé :

```typescript
// Dans userModel.ts
userSchema.pre('remove', async function(next) {
  await Activity.deleteMany({ createdBy: this._id });
  next();
});
```

### Cron Job (Recommandé)
Ajoutez un cron job qui nettoie périodiquement les activités orphelines :

```typescript
// Dans src/jobs/cleanupCron.ts
import cron from 'node-cron';
import { cleanOrphanActivities } from '../scripts/cleanOrphanActivities';

// Exécuter tous les jours à 3h du matin
cron.schedule('0 3 * * *', async () => {
  console.log('[Cron] Running orphan activities cleanup...');
  await cleanOrphanActivities();
});
```

## Vérification

Pour vérifier qu'il n'y a plus d'activités orphelines :

```javascript
// Dans MongoDB shell ou Compass
db.activities.aggregate([
  {
    $lookup: {
      from: 'users',
      localField: 'createdBy',
      foreignField: '_id',
      as: 'creator'
    }
  },
  {
    $match: {
      creator: { $size: 0 }
    }
  },
  {
    $count: 'orphanCount'
  }
])
```

## Notes
- Les activités sont maintenant supprimées **immédiatement** lors de la suppression du compte
- Le filtrage côté API empêche les activités orphelines d'apparaître dans le frontend
- Le script de nettoyage peut être exécuté à tout moment pour nettoyer les données existantes
