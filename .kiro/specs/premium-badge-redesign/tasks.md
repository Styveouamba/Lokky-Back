# Implementation Plan: Premium Badge Redesign

## Overview

Ce plan d'implémentation détaille les étapes pour remplacer le badge premium actuel (étoile jaune Ionicons) par un nouveau badge moderne avec forme organique, gradient violet/mauve, effet 3D et étoile scintillante. L'implémentation se fera de manière incrémentale en créant d'abord le composant réutilisable, puis en l'intégrant dans les différents écrans de l'application.

## Tasks

- [x] 1. Créer le composant PremiumBadge avec rendu SVG de base
  - Créer le fichier `Frontend/components/ui/PremiumBadge.tsx`
  - Implémenter l'interface `PremiumBadgeProps` avec les props: size, disableAnimation, style, accessibilityLabel
  - Implémenter le mapping des tailles (small: 16px, medium: 24px, large: 48px)
  - Créer la structure SVG de base avec viewBox 24x24
  - Implémenter la forme organique (blob) avec le path SVG
  - Ajouter le gradient linéaire violet/mauve (#8B5CF6 à #A78BFA)
  - Ajouter l'étoile scintillante dorée (#FBBF24) en position top-right
  - Ajouter l'effet d'ombre pour la profondeur 3D
  - Implémenter les propriétés d'accessibilité (accessible, accessibilityLabel, accessibilityRole)
  - Utiliser React.memo pour optimiser les performances
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.1, 2.2, 2.3, 2.4_

- [ ]* 1.1 Écrire les tests unitaires pour le composant PremiumBadge
  - Tester le rendu des éléments SVG (Path, LinearGradient, Polygon)
  - Tester les couleurs du gradient (#8B5CF6, #A78BFA)
  - Tester la couleur de l'étoile (#FBBF24)
  - Tester les propriétés d'ombre
  - Tester les dimensions pour chaque taille (small: 16px, medium: 24px, large: 48px)
  - Tester les propriétés d'accessibilité
  - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.2, 2.3, 2.4_

- [ ]* 1.2 Écrire le test de propriété pour les dimensions des variantes de taille
  - **Property 1: Size Variant Dimensions**
  - **Validates: Requirements 1.3**
  - Utiliser fast-check pour générer les tailles (small, medium, large)
  - Vérifier que chaque taille produit les dimensions exactes (16px, 24px, 48px)
  - Minimum 100 itérations

- [ ]* 1.3 Écrire le test de propriété pour la propagation des labels d'accessibilité
  - **Property 2: Accessibility Label Propagation**
  - **Validates: Requirements 1.7**
  - Utiliser fast-check pour générer des chaînes de caractères aléatoires
  - Vérifier que le label est correctement appliqué au composant
  - Minimum 100 itérations

- [ ]* 1.4 Écrire le test de propriété pour la préservation de la qualité visuelle
  - **Property 3: Visual Quality Preservation Across Sizes**
  - **Validates: Requirements 2.5**
  - Utiliser fast-check pour générer les tailles
  - Vérifier que le viewBox reste 24x24 (aspect ratio 1:1)
  - Vérifier que tous les éléments SVG sont présents
  - Minimum 100 itérations

- [ ] 2. Implémenter l'animation de scintillement
  - Importer les hooks et composants de react-native-reanimated
  - Créer le shared value `sparkleOpacity` avec useSharedValue
  - Implémenter l'animation fade-in/fade-out avec withSequence et withTiming
  - Configurer la durée de l'animation (1000ms par phase, 2000ms total)
  - Configurer la répétition infinie avec withRepeat
  - Créer le composant AnimatedPolygon avec Animated.createAnimatedComponent
  - Appliquer les props animés à l'étoile scintillante
  - Implémenter la logique de désactivation via le prop disableAnimation
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ]* 2.1 Écrire les tests unitaires pour l'animation
  - Tester la configuration de l'animation (withSequence, withTiming, withRepeat)
  - Tester la durée de l'animation (2000ms total)
  - Tester le loop continu
  - Tester l'état statique quand disableAnimation est true
  - _Requirements: 6.1, 6.2, 6.3, 6.5_

- [ ]* 2.2 Écrire le test de propriété pour le contrôle de l'animation
  - **Property 5: Animation Control via Prop**
  - **Validates: Requirements 6.4**
  - Utiliser fast-check pour générer des valeurs booléennes
  - Vérifier que l'animation est activée/désactivée selon le prop
  - Minimum 100 itérations

- [ ] 3. Checkpoint - Vérifier le composant PremiumBadge
  - S'assurer que tous les tests passent
  - Vérifier visuellement le rendu du badge dans Storybook ou un écran de test
  - Demander à l'utilisateur si des questions se posent

- [x] 4. Intégrer le badge dans l'écran de profil (profile.tsx)
  - Importer le composant PremiumBadge dans `Frontend/app/(tabs)/profile.tsx`
  - Remplacer le badge "Premium" textuel par le composant PremiumBadge
  - Utiliser la taille 'small' pour le badge
  - Positionner le badge avec marginLeft: 'auto' et marginRight: 8
  - Maintenir la logique conditionnelle basée sur user?.premium?.isActive
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 8.1, 8.2, 8.3_

- [ ]* 4.1 Écrire les tests d'intégration pour profile.tsx
  - Tester le remplacement du badge textuel
  - Tester l'utilisation de la taille 'small'
  - Tester l'espacement (marginLeft: 'auto', marginRight: 8)
  - Tester le rendu conditionnel basé sur user.premium.isActive
  - _Requirements: 3.2, 3.3, 3.4, 3.5_

- [ ]* 4.2 Écrire le test de propriété pour le rendu conditionnel
  - **Property 4: Conditional Rendering Based on Premium Status**
  - **Validates: Requirements 3.1, 3.5, 8.1**
  - Utiliser fast-check pour générer des objets utilisateur avec différents statuts premium
  - Vérifier que le badge s'affiche si et seulement si user.premium.isActive est true
  - Minimum 100 itérations

- [x] 5. Intégrer le badge dans l'écran de galerie (gallery.tsx)
  - Importer le composant PremiumBadge dans `Frontend/app/(tabs)/gallery.tsx`
  - Remplacer l'icône Ionicons star par le composant PremiumBadge
  - Utiliser la taille 'small' pour le badge
  - Maintenir l'alignement vertical centré avec le nom d'utilisateur
  - Maintenir l'espacement de 6px (gap existant dans userInfo)
  - Maintenir la logique conditionnelle basée sur item.userId.premium?.isActive
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 8.1, 8.2, 8.4_

- [ ]* 5.1 Écrire les tests d'intégration pour gallery.tsx
  - Tester le remplacement de l'icône Ionicons
  - Tester l'utilisation de la taille 'small'
  - Tester l'alignement vertical avec le texte
  - Tester l'espacement (gap: 6px)
  - Tester le rendu conditionnel basé sur item.userId.premium.isActive
  - _Requirements: 4.2, 4.3, 4.4, 4.5_

- [x] 6. Intégrer le badge dans l'écran de profil utilisateur (user-profile.tsx)
  - Importer le composant PremiumBadge dans `Frontend/app/(profile)/user-profile.tsx`
  - Ajouter le badge à côté du nom du profil (ligne ~200)
  - Créer une View avec flexDirection: 'row', alignItems: 'center', gap: 6
  - Utiliser la taille 'small' pour le badge
  - Maintenir la logique conditionnelle basée sur profile.user.premium?.isActive
  - _Requirements: 3.1, 8.1, 8.2, 8.5_

- [ ]* 6.1 Écrire les tests d'intégration pour user-profile.tsx
  - Tester l'ajout du badge à côté du nom
  - Tester l'utilisation de la taille 'small'
  - Tester l'alignement et l'espacement (gap: 6px)
  - Tester le rendu conditionnel basé sur profile.user.premium.isActive
  - _Requirements: 3.1, 8.5_

- [ ] 7. Checkpoint - Vérifier les intégrations
  - S'assurer que tous les tests d'intégration passent
  - Vérifier visuellement le badge dans les trois écrans (profile, gallery, user-profile)
  - Tester avec des utilisateurs premium et non-premium
  - Demander à l'utilisateur si des questions se posent

- [ ] 8. Optimiser les performances et la compatibilité
  - Vérifier que React.memo est bien appliqué au composant PremiumBadge
  - Tester le rendu dans une FlatList avec 50+ items (gallery.tsx)
  - Vérifier que le scrolling reste fluide (60 FPS)
  - Tester la compatibilité avec les thèmes clair et sombre
  - Vérifier le contraste du badge sur les deux thèmes
  - Tester sur différentes densités d'écran (1x, 2x, 3x)
  - Tester sur différentes tailles d'écran (< 375px, > 768px)
  - _Requirements: 7.1, 7.2, 7.4, 9.1, 9.2, 9.3, 9.4, 10.1, 10.2_

- [ ]* 8.1 Écrire les tests de performance
  - Tester le rendu dans une FlatList avec 50+ badges
  - Mesurer le FPS pendant le scroll
  - Vérifier que le FPS reste >= 60
  - Vérifier l'utilisation de React.memo
  - _Requirements: 7.1, 7.2, 7.4_

- [ ]* 8.2 Écrire le test de propriété pour le scaling proportionnel
  - **Property 6: Proportional Scaling Across Screen Densities**
  - **Validates: Requirements 9.1**
  - Utiliser fast-check pour générer des densités d'écran (1x, 2x, 3x) et des tailles
  - Vérifier que les dimensions sont cohérentes et l'aspect ratio est 1:1
  - Minimum 100 itérations

- [ ]* 8.3 Écrire le test de propriété pour l'adaptation à la taille du texte
  - **Property 7: Text Size Adaptation**
  - **Validates: Requirements 9.5**
  - Utiliser fast-check pour générer des tailles de texte (12-32px)
  - Vérifier que le badge s'aligne correctement verticalement avec le texte
  - Minimum 100 itérations

- [ ]* 8.4 Écrire le test de propriété pour la cohérence visuelle selon le thème
  - **Property 8: Theme-Based Visual Consistency**
  - **Validates: Requirements 10.3, 10.4, 10.5**
  - Utiliser fast-check pour générer des thèmes (clair/sombre)
  - Vérifier que les couleurs du gradient restent inchangées
  - Vérifier que l'étoile dorée reste visible
  - Minimum 100 itérations

- [ ] 9. Tests de compatibilité multi-plateformes
  - Tester le badge sur iOS (simulateur et appareil physique si possible)
  - Tester le badge sur Android (émulateur et appareil physique si possible)
  - Vérifier que le rendu SVG est identique sur les deux plateformes
  - Vérifier que l'animation fonctionne correctement sur les deux plateformes
  - Vérifier les performances sur les deux plateformes
  - _Requirements: 9.2_

- [ ]* 9.1 Écrire les tests de régression visuelle
  - Créer des snapshots du badge pour chaque taille
  - Créer des snapshots du badge dans chaque écran
  - Créer des snapshots pour les thèmes clair et sombre
  - _Requirements: 2.5, 2.6, 2.7, 10.1, 10.2_

- [ ] 10. Checkpoint final - Validation complète
  - S'assurer que tous les tests passent (unitaires, propriétés, intégration, performance)
  - Vérifier que le badge fonctionne correctement dans tous les écrans
  - Vérifier que les performances sont optimales (60 FPS dans les listes)
  - Vérifier la compatibilité avec les thèmes clair et sombre
  - Vérifier la compatibilité iOS et Android
  - Demander à l'utilisateur de valider le résultat final

## Notes

- Les tâches marquées avec `*` sont optionnelles et peuvent être sautées pour un MVP plus rapide
- Chaque tâche référence les exigences spécifiques pour la traçabilité
- Les checkpoints assurent une validation incrémentale
- Les tests de propriétés valident les propriétés de correction universelles
- Les tests unitaires valident des exemples spécifiques et des cas limites
- L'implémentation suit une approche incrémentale: composant → animation → intégrations → optimisation
