# Requirements Document: Premium Badge Redesign

## Introduction

Ce document définit les exigences pour le remplacement du badge premium actuel (étoile jaune simple) par un badge premium unique et visuellement distinctif. Le nouveau badge sera inspiré d'un design moderne avec une forme organique, des effets de gradient violets/mauves, un effet 3D avec ombres et profondeur, et une petite étoile scintillante dorée. L'objectif est de créer un indicateur visuel premium qui se démarque et communique clairement le statut premium des utilisateurs à travers l'application Lokky.

## Glossary

- **Premium_Badge_Component**: Composant React Native réutilisable qui affiche le nouveau badge premium
- **Badge_Renderer**: Service responsable du rendu du badge avec les effets visuels (gradient, ombre, 3D)
- **Profile_Display**: Écran de profil utilisateur où le badge est affiché
- **Gallery_Display**: Écran de galerie où le badge apparaît à côté du nom d'utilisateur
- **Activity_Card**: Carte d'activité où le badge peut apparaître pour les créateurs premium
- **SVG_Badge**: Représentation vectorielle du badge pour garantir la qualité à toutes les tailles
- **Gradient_Effect**: Effet de dégradé de couleur violet/mauve appliqué au badge
- **Shadow_Effect**: Effet d'ombre portée pour créer la profondeur 3D
- **Sparkle_Star**: Petite étoile dorée/jaune scintillante positionnée en haut à droite du badge

## Requirements

### Requirement 1: Badge Component Creation

**User Story:** En tant que développeur, je veux créer un composant de badge premium réutilisable, afin de pouvoir l'afficher de manière cohérente à travers toute l'application.

#### Acceptance Criteria

1. THE Premium_Badge_Component SHALL be implemented as a React Native component accepting size and style props
2. THE Premium_Badge_Component SHALL render using SVG for scalability and visual quality
3. THE Premium_Badge_Component SHALL support multiple size variants (small: 16px, medium: 24px, large: 48px)
4. WHEN the component is rendered, THE Premium_Badge_Component SHALL display the organic blob shape with violet/mauve gradient
5. THE Premium_Badge_Component SHALL include the sparkle star element positioned at the top-right corner
6. THE Premium_Badge_Component SHALL apply shadow effects to create 3D depth
7. THE Premium_Badge_Component SHALL be accessible with appropriate accessibility labels

### Requirement 2: Visual Design Implementation

**User Story:** En tant qu'utilisateur premium, je veux voir un badge visuellement distinctif et attrayant, afin que mon statut premium soit clairement reconnaissable.

#### Acceptance Criteria

1. THE Badge_Renderer SHALL implement an organic blob shape (non-circular, asymmetric form)
2. THE Badge_Renderer SHALL apply a violet-to-mauve gradient effect (#8B5CF6 to #A78BFA range)
3. THE Badge_Renderer SHALL render a golden/yellow sparkle star (#FBBF24) at the top-right position
4. THE Badge_Renderer SHALL apply shadow effects with appropriate offset and blur radius for 3D appearance
5. THE Badge_Renderer SHALL ensure the badge maintains visual quality at all supported sizes
6. WHEN rendered on light backgrounds, THE Badge_Renderer SHALL ensure sufficient contrast for visibility
7. WHEN rendered on dark backgrounds, THE Badge_Renderer SHALL ensure sufficient contrast for visibility

### Requirement 3: Profile Display Integration

**User Story:** En tant qu'utilisateur, je veux voir le nouveau badge premium sur les profils utilisateurs, afin d'identifier facilement les membres premium.

#### Acceptance Criteria

1. WHEN a user has an active premium subscription, THE Profile_Display SHALL show the Premium_Badge_Component next to the user's name
2. THE Profile_Display SHALL replace the existing yellow star icon with the new Premium_Badge_Component
3. THE Profile_Display SHALL use the medium size variant (24px) for the badge
4. THE Profile_Display SHALL position the badge with appropriate spacing (4-8px margin) from the username
5. WHEN a user does not have premium status, THE Profile_Display SHALL NOT display any premium badge

### Requirement 4: Gallery Display Integration

**User Story:** En tant qu'utilisateur parcourant la galerie, je veux voir le badge premium à côté des noms d'utilisateurs premium, afin de reconnaître rapidement le contenu des membres premium.

#### Acceptance Criteria

1. WHEN a gallery item is created by a premium user, THE Gallery_Display SHALL show the Premium_Badge_Component next to the creator's name
2. THE Gallery_Display SHALL replace the existing Ionicons star with the new Premium_Badge_Component
3. THE Gallery_Display SHALL use the small size variant (16px) for the badge
4. THE Gallery_Display SHALL align the badge vertically centered with the username text
5. THE Gallery_Display SHALL maintain consistent spacing (4px margin) between username and badge

### Requirement 5: Activity Card Integration

**User Story:** En tant qu'utilisateur consultant des activités, je veux voir le badge premium sur les activités créées par des membres premium, afin de distinguer le contenu premium.

#### Acceptance Criteria

1. WHEN an activity is created by a premium user, THE Activity_Card SHALL display the Premium_Badge_Component in the overlay section
2. THE Activity_Card SHALL replace the existing crown icon with the new Premium_Badge_Component
3. THE Activity_Card SHALL use the small size variant (16px) for the badge overlay
4. THE Activity_Card SHALL position the badge in the top-left corner with appropriate padding (12px from edges)
5. THE Activity_Card SHALL ensure the badge remains visible over activity images with proper contrast

### Requirement 6: Badge Animation

**User Story:** En tant qu'utilisateur premium, je veux que le badge ait une animation subtile, afin d'attirer l'attention de manière élégante sans être distrayant.

#### Acceptance Criteria

1. THE Premium_Badge_Component SHALL implement a subtle sparkle animation on the star element
2. THE Premium_Badge_Component SHALL animate the sparkle with a fade-in/fade-out effect (duration: 1.5-2 seconds)
3. THE Premium_Badge_Component SHALL loop the sparkle animation continuously with appropriate timing
4. THE Premium_Badge_Component SHALL allow disabling animation via a prop for accessibility preferences
5. WHEN animation is disabled, THE Premium_Badge_Component SHALL display the sparkle star in a static state

### Requirement 7: Performance Optimization

**User Story:** En tant que développeur, je veux que le badge soit performant, afin de ne pas impacter négativement les performances de l'application.

#### Acceptance Criteria

1. THE Premium_Badge_Component SHALL render efficiently without causing frame drops in scrollable lists
2. THE Premium_Badge_Component SHALL use memoization to prevent unnecessary re-renders
3. THE Premium_Badge_Component SHALL load SVG assets efficiently with appropriate caching
4. WHEN multiple badges are displayed simultaneously, THE Badge_Renderer SHALL maintain smooth scrolling performance (60 FPS)
5. THE Premium_Badge_Component SHALL have a bundle size impact of less than 5KB

### Requirement 8: Backward Compatibility

**User Story:** En tant que développeur, je veux assurer une transition en douceur, afin que le remplacement du badge n'introduise pas de régressions.

#### Acceptance Criteria

1. THE Premium_Badge_Component SHALL maintain the same conditional rendering logic as the existing badge (based on user.premium.isActive)
2. THE Premium_Badge_Component SHALL work with the existing premium subscription system without modifications
3. WHEN the new badge is deployed, THE Profile_Display SHALL continue to function correctly for all user types
4. WHEN the new badge is deployed, THE Gallery_Display SHALL continue to function correctly for all user types
5. WHEN the new badge is deployed, THE Activity_Card SHALL continue to function correctly for all user types

### Requirement 9: Responsive Design

**User Story:** En tant qu'utilisateur sur différents appareils, je veux que le badge s'affiche correctement, afin d'avoir une expérience cohérente quelle que soit la taille de l'écran.

#### Acceptance Criteria

1. THE Premium_Badge_Component SHALL scale proportionally on different screen densities (1x, 2x, 3x)
2. THE Premium_Badge_Component SHALL maintain aspect ratio and visual quality on all iOS and Android devices
3. WHEN displayed on small screens (< 375px width), THE Premium_Badge_Component SHALL remain clearly visible and recognizable
4. WHEN displayed on large screens (> 768px width), THE Premium_Badge_Component SHALL maintain appropriate proportions
5. THE Premium_Badge_Component SHALL adapt to different text sizes when used alongside usernames

### Requirement 10: Theme Compatibility

**User Story:** En tant qu'utilisateur utilisant le mode sombre ou clair, je veux que le badge soit visible dans les deux thèmes, afin d'avoir une expérience cohérente.

#### Acceptance Criteria

1. WHEN the app is in light mode, THE Premium_Badge_Component SHALL render with appropriate shadow and contrast
2. WHEN the app is in dark mode, THE Premium_Badge_Component SHALL render with appropriate shadow and contrast
3. THE Premium_Badge_Component SHALL adjust shadow opacity based on the current theme (lighter shadows in dark mode)
4. THE Premium_Badge_Component SHALL maintain the violet/mauve gradient colors in both themes
5. THE Premium_Badge_Component SHALL ensure the golden sparkle star remains visible in both themes
