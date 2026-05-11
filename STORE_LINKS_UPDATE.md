# Mise à jour des liens des stores

## Liens officiels

- **App Store (iOS)**: https://apps.apple.com/sn/app/lokky/id6761419238?l=fr-FR
- **Play Store (Android)**: https://play.google.com/store/apps/details?id=com.nach17.lokky

## Fichiers mis à jour

### Backend
- ✅ `Backend/src/controllers/appController.ts` - URLs des stores pour les mises à jour de l'app

### Frontend
- ✅ `Frontend/hooks/use-app-updates.ts` - Fallback URLs pour ouvrir les stores

### Landing Page
- ✅ `LandingPage/.env` - Variables d'environnement (créé)
- ✅ `LandingPage/.env.local` - Variables d'environnement locales
- ✅ `LandingPage/.env.example` - Exemple de configuration

## Fonctionnalités impactées

### 1. Landing Page
- Boutons "App Store" et "Google Play" dans la section Hero
- Boutons "App Store" et "Google Play" dans la section CTA
- Liens dans la page d'activité dynamique (`/activity/[id]`)

### 2. Deep Links
Les liens de partage d'activités pointent vers la landing page qui redirige vers l'app :
- Format: `https://lokky.akylian.com/activity/{activityId}`
- La landing page affiche l'activité avec des boutons pour télécharger l'app
- Les métadonnées Open Graph sont configurées pour un beau partage sur les réseaux sociaux

### 3. Mises à jour de l'app
- L'app vérifie les mises à jour via l'API backend
- Si une mise à jour est disponible, l'utilisateur est redirigé vers le store approprié

## Déploiement

### Landing Page
Après avoir mis à jour les fichiers `.env`, redéployer la landing page :
```bash
cd LandingPage
npm run build
# Déployer sur Vercel/Netlify/autre
```

### Backend
Le backend doit être redéployé pour que les nouvelles URLs soient prises en compte :
```bash
cd Backend
npm run build
# Redémarrer le serveur
```

### Frontend (App Mobile)
Aucune action requise - les URLs sont déjà configurées dans le code.

## Test

### Tester les liens de la landing page
1. Visiter https://lokky.akylian.com
2. Cliquer sur les boutons "App Store" et "Google Play"
3. Vérifier que les liens ouvrent les bonnes pages des stores

### Tester le partage d'activité
1. Dans l'app, partager une activité
2. Ouvrir le lien partagé dans un navigateur
3. Vérifier que la page d'activité s'affiche correctement
4. Cliquer sur les boutons de téléchargement
5. Vérifier que les stores s'ouvrent correctement

### Tester les mises à jour
1. Dans l'app, aller dans Paramètres > Vérifier les mises à jour
2. Si une mise à jour est disponible, vérifier que le store s'ouvre correctement

## Notes

- Les liens incluent les paramètres de localisation (`l=fr-FR` pour iOS)
- Les liens sont configurés pour fonctionner sur tous les pays
- Les deep links utilisent le format `lokky://` pour ouvrir l'app directement
- La landing page sert de fallback pour les utilisateurs qui n'ont pas l'app installée
