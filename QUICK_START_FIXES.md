# 🚀 Guide Rapide - Utilisation des Corrections

## Pour activer la synchronisation des compteurs non lus

### Étape 1: Importer le hook
Dans vos écrans de conversations, ajoutez:

```typescript
import { useUnreadSync } from '@/hooks/use-unread-sync';
```

### Étape 2: Activer la synchronisation
Dans le composant:

```typescript
function ConversationsScreen() {
  useUnreadSync(); // ← Ajouter cette ligne
  
  // Reste du code...
}
```

### Exemple complet:

```typescript
import { useUnreadSync } from '@/hooks/use-unread-sync';
import { useMessageStore } from '@/stores/messageStore';

export default function ConversationsScreen() {
  // Active la synchronisation automatique toutes les 30s
  useUnreadSync();
  
  const conversations = useMessageStore((state) => state.conversations);
  
  return (
    <View>
      {conversations.map((conv) => (
        <ConversationItem
          key={conv._id}
          conversation={conv}
          unreadCount={conv.unreadCount} // ← Toujours à jour!
        />
      ))}
    </View>
  );
}
```

## Écrans où ajouter le hook

Ajoutez `useUnreadSync()` dans ces écrans:

1. ✅ `app/(tabs)/messages.tsx` - Liste des conversations
2. ✅ `app/(tabs)/index.tsx` - Page d'accueil (si elle affiche des conversations)
3. ✅ `app/_layout.tsx` - Layout principal (pour sync globale)

## Configuration (optionnel)

Pour changer l'intervalle de synchronisation, modifiez dans `hooks/use-unread-sync.ts`:

```typescript
// Synchroniser toutes les 60 secondes au lieu de 30
const interval = setInterval(() => {
  syncUnreadCounts(token);
}, 60 * 1000); // ← Changer ici
```

## Vérification

Pour vérifier que ça fonctionne:

1. Ouvrir les DevTools
2. Chercher dans les logs: `Sync unread counts`
3. Vérifier que les compteurs se mettent à jour

## Dépannage

### Le hook ne se déclenche pas
- Vérifier que l'utilisateur est connecté (`token` existe)
- Vérifier que le socket est connecté (`connected === true`)

### Les compteurs ne se mettent pas à jour
- Vérifier les logs backend pour l'endpoint `/messages/unread-counts`
- Vérifier que la route est bien enregistrée dans `messageRoutes.ts`

## C'est tout! 🎉

Les deux autres corrections (race condition et mutex) sont automatiques et ne nécessitent aucune action de votre part.
