# 🔧 Recommandations d'Améliorations - Projet Lokky

## 🔴 PROBLÈMES CRITIQUES À CORRIGER

### 1. Race Condition dans les Messages Temporaires
**Problème:** Le remplacement des messages temporaires peut échouer si la réponse serveur arrive avant que le message temporaire soit ajouté au store.

**Solution:** Utiliser un Map pour tracker les messages temporaires avec leur timestamp

```typescript
// Dans messageStore.ts
interface MessageState {
  // ... existing fields
  pendingMessages: Map<string, { tempId: string; timestamp: number }>;
}

// Dans sendMessage:
const tempId = `temp-${Date.now()}-${Math.random()}`;
const pendingKey = `${conversationId}-${content.trim()}`;

// Tracker le message temporaire
const { pendingMessages } = get();
pendingMessages.set(pendingKey, { tempId, timestamp: Date.now() });

// Dans new_message handler:
const pendingKey = `${conversationId}-${message.content}`;
const pending = pendingMessages.get(pendingKey);

if (pending && user && message.sender._id === user._id) {
  // Remplacer par l'ID temporaire exact
  const tempMessageIndex = conversationMessages.findIndex(
    msg => msg._id === pending.tempId
  );
  
  if (tempMessageIndex !== -1) {
    updatedMessages[tempMessageIndex] = message;
  }
  
  // Nettoyer
  pendingMessages.delete(pendingKey);
}
```

### 2. Désynchronisation du Compteur de Messages Non Lus
**Problème:** Le frontend met à jour `unreadCount` de manière optimiste mais le backend peut avoir un calcul différent.

**Solution:** Ajouter un endpoint pour récupérer le compteur exact et le synchroniser périodiquement

```typescript
// Backend: messageController.ts
export const getUnreadCounts = async (req: AuthRequest, res: Response) => {
  try {
    const conversations = await Conversation.find({
      participants: req.userId,
    }).select('_id');

    const counts = await Promise.all(
      conversations.map(async (conv) => {
        const count = await Message.countDocuments({
          conversation: conv._id,
          sender: { $ne: req.userId },
          read: false,
          deletedFor: { $ne: req.userId },
        });
        return { conversationId: conv._id, count };
      })
    );

    res.json({ counts });
  } catch (error) {
    res.status(500).json({ message: 'Erreur' });
  }
};

// Frontend: messageStore.ts
syncUnreadCounts: async (token: string) => {
  const response = await fetch(`${API_URL}/messages/unread-counts`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  
  const { counts } = await response.json();
  
  const { conversations } = get();
  const updated = conversations.map(conv => {
    const countData = counts.find(c => c.conversationId === conv._id);
    return countData ? { ...conv, unreadCount: countData.count } : conv;
  });
  
  set({ conversations: updated });
},
```

### 3. Cache d'Activités Non Invalidé sur Changement de Statut
**Problème:** Le cache des activités n'est pas invalidé quand le statut d'une activité change (ex: passée, annulée).

**Solution:** Écouter les événements de changement de statut via Socket.IO

```typescript
// Backend: socketHandler.ts
export const notifyActivityStatusChange = (activityId: string, newStatus: string) => {
  const io = getIO();
  io.emit('activity_status_changed', { activityId, status: newStatus });
};

// Frontend: activityStore.ts
socket.on('activity_status_changed', (data) => {
  const { activities } = get();
  
  // Mettre à jour l'activité localement
  const updated = activities.map(activity =>
    activity._id === data.activityId
      ? { ...activity, status: data.status }
      : activity
  );
  
  set({ activities: updated });
  
  // Invalider le cache si nécessaire
  if (data.status === 'cancelled' || data.status === 'completed') {
    get().clearActivities();
  }
});
```

### 4. Multiple Tentatives de Déconnexion sur Token Expiré
**Problème:** Plusieurs requêtes 401 simultanées peuvent déclencher plusieurs appels à `logout()`.

**Solution:** Utiliser un mutex pour garantir une seule déconnexion

```typescript
// apiService.ts
let logoutInProgress = false;
let logoutPromise: Promise<void> | null = null;

private async handleTokenExpiration() {
  if (logoutInProgress) {
    // Attendre que la déconnexion en cours se termine
    return logoutPromise;
  }

  logoutInProgress = true;
  sessionExpiredModalVisible = true;

  logoutPromise = (async () => {
    try {
      const authStore = useAuthStore.getState();
      await authStore.logout();
      sessionExpiredCallbacks.forEach((callback) => callback());
    } finally {
      logoutInProgress = false;
      logoutPromise = null;
    }
  })();

  return logoutPromise;
}
```

## 🟡 PROBLÈMES MODÉRÉS À AMÉLIORER

### 5. Statut de Modération Non Rafraîchi Automatiquement
**Problème:** Le statut de modération est mis à jour via socket mais pas vérifié périodiquement.

**Solution:** Ajouter une vérification périodique du statut

```typescript
// Frontend: hooks/use-moderation-check.ts
useEffect(() => {
  if (!token) return;

  // Vérifier immédiatement
  checkStatus();

  // Vérifier toutes les 5 minutes
  const interval = setInterval(() => {
    checkStatus();
  }, 5 * 60 * 1000);

  return () => clearInterval(interval);
}, [token]);
```

### 6. Cache du Leaderboard avec Données Obsolètes
**Problème:** Le cache Redis de 5 minutes peut afficher des classements obsolètes.

**Solution:** Ajouter un système de cache-busting manuel

```typescript
// Backend: userController.ts
export const invalidateLeaderboardCache = async () => {
  await cacheService.deletePattern('leaderboard:*');
};

// Appeler après chaque action qui affecte le classement:
// - Création d'activité
// - Participation à une activité
// - Attribution de note

// Frontend: Ajouter un bouton de rafraîchissement
const refreshLeaderboard = async () => {
  await apiCall.post('/users/leaderboard/refresh');
  await fetchLeaderboard(selectedType);
};
```

### 7. Indicateur de Frappe Non Nettoyé
**Problème:** Si un utilisateur se déconnecte pendant qu'il tape, l'indicateur reste affiché.

**Solution:** Ajouter un timeout automatique

```typescript
// Frontend: messageStore.ts
const typingTimeouts: Record<string, NodeJS.Timeout> = {};

socket.on('user_typing', (data: { userId: string; isTyping: boolean }) => {
  const { typingUsers } = get();
  
  // Nettoyer le timeout précédent
  if (typingTimeouts[data.userId]) {
    clearTimeout(typingTimeouts[data.userId]);
  }
  
  if (data.isTyping) {
    // Définir un timeout de 3 secondes
    typingTimeouts[data.userId] = setTimeout(() => {
      set({
        typingUsers: {
          ...get().typingUsers,
          [data.userId]: false,
        },
      });
    }, 3000);
  }
  
  set({
    typingUsers: {
      ...typingUsers,
      [data.userId]: data.isTyping,
    },
  });
});
```

### 8. Validation des Push Tokens Asynchrone
**Problème:** Les tokens invalides sont supprimés de manière asynchrone, ce qui peut causer des échecs de notification.

**Solution:** Valider avant d'envoyer et mettre en cache les tokens valides

```typescript
// Backend: notificationService.ts
const validTokensCache = new Map<string, { token: string; validUntil: number }>();

const getValidatedPushToken = async (userId: string): Promise<string | null> => {
  // Vérifier le cache
  const cached = validTokensCache.get(userId);
  if (cached && cached.validUntil > Date.now()) {
    return cached.token;
  }

  const token = await getUserPushToken(userId);
  
  if (token && isExpoPushToken(token)) {
    // Mettre en cache pour 1 heure
    validTokensCache.set(userId, {
      token,
      validUntil: Date.now() + 60 * 60 * 1000,
    });
    return token;
  }

  return null;
};
```

## 🟢 AMÉLIORATIONS RECOMMANDÉES

### 9. Système de Retry pour les Requêtes Échouées
**Ajout:** Implémenter un système de retry automatique pour les requêtes réseau

```typescript
// Frontend: services/apiService.ts
private async fetchWithRetry<T>(
  url: string,
  options: RequestInit,
  retries = 3
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      
      // Retry sur erreurs 5xx
      if (response.status >= 500 && i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        continue;
      }
      
      return response;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  
  throw new Error('Max retries reached');
}
```

### 10. Optimistic UI pour Plus d'Actions
**Ajout:** Étendre l'optimistic UI aux participations, likes, etc.

```typescript
// Frontend: activityStore.ts
joinActivity: async (token: string, activityId: string) => {
  const { activities } = get();
  const { user } = useAuthStore.getState();
  
  // Mise à jour optimiste
  const optimisticActivities = activities.map(activity => {
    if (activity._id === activityId) {
      return {
        ...activity,
        participants: [...activity.participants, user],
        participantCount: activity.participantCount + 1,
      };
    }
    return activity;
  });
  
  set({ activities: optimisticActivities });
  
  try {
    await apiCall.post(`/activities/${activityId}/join`);
  } catch (error) {
    // Rollback en cas d'erreur
    set({ activities });
    throw error;
  }
},
```

### 11. Pagination Infinie pour les Activités
**Ajout:** Implémenter le scroll infini au lieu de la pagination classique

```typescript
// Frontend: activityStore.ts
interface ActivityState {
  // ... existing
  hasMoreActivities: boolean;
  loadingMore: boolean;
  currentPage: number;
}

loadMoreActivities: async (token: string, filters: any) => {
  const { loadingMore, hasMoreActivities, currentPage, activities } = get();
  
  if (loadingMore || !hasMoreActivities) return;
  
  set({ loadingMore: true });
  
  try {
    const response = await apiCall.get('/activities', {
      ...filters,
      page: currentPage + 1,
      limit: 20,
    });
    
    set({
      activities: [...activities, ...response.activities],
      currentPage: currentPage + 1,
      hasMoreActivities: response.hasMore,
      loadingMore: false,
    });
  } catch (error) {
    set({ loadingMore: false });
  }
},
```

### 12. Système de Notifications In-App
**Ajout:** Afficher les notifications dans l'app en plus des push

```typescript
// Frontend: stores/notificationStore.ts
interface InAppNotification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  action?: {
    label: string;
    onPress: () => void;
  };
}

export const useNotificationStore = create<{
  notifications: InAppNotification[];
  addNotification: (notification: Omit<InAppNotification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  clearAll: () => void;
}>((set) => ({
  notifications: [],
  
  addNotification: (notification) => {
    const newNotif: InAppNotification = {
      ...notification,
      id: `notif-${Date.now()}`,
      timestamp: new Date(),
      read: false,
    };
    
    set((state) => ({
      notifications: [newNotif, ...state.notifications].slice(0, 50), // Max 50
    }));
    
    // Auto-dismiss après 5 secondes pour les info/success
    if (notification.type === 'info' || notification.type === 'success') {
      setTimeout(() => {
        set((state) => ({
          notifications: state.notifications.filter(n => n.id !== newNotif.id),
        }));
      }, 5000);
    }
  },
  
  markAsRead: (id) => {
    set((state) => ({
      notifications: state.notifications.map(n =>
        n.id === id ? { ...n, read: true } : n
      ),
    }));
  },
  
  clearAll: () => set({ notifications: [] }),
}));
```

### 13. Système de Mise à Jour Store/App Store
**Ajout:** Vérifier les mises à jour natives et forcer si nécessaire

```typescript
// Frontend: hooks/use-app-updates.ts
import * as Application from 'expo-application';
import { Platform, Linking, Alert } from 'react-native';

export function useAppUpdates() {
  const checkStoreUpdate = async () => {
    try {
      const currentVersion = Application.nativeApplicationVersion;
      
      // Appeler votre API backend
      const response = await fetch(`${API_URL}/app/version`);
      const { latestVersion, minimumVersion, forceUpdate } = await response.json();
      
      const isOutdated = compareVersions(currentVersion, minimumVersion) < 0;
      const updateAvailable = compareVersions(currentVersion, latestVersion) < 0;
      
      if (isOutdated || forceUpdate) {
        // Mise à jour obligatoire
        Alert.alert(
          'Mise à jour requise',
          'Une nouvelle version est disponible. Veuillez mettre à jour l\'application.',
          [
            {
              text: 'Mettre à jour',
              onPress: () => {
                const storeUrl = Platform.select({
                  ios: 'https://apps.apple.com/app/YOUR_APP_ID',
                  android: 'https://play.google.com/store/apps/details?id=YOUR_PACKAGE',
                });
                if (storeUrl) Linking.openURL(storeUrl);
              },
            },
          ],
          { cancelable: false }
        );
      } else if (updateAvailable) {
        // Mise à jour optionnelle
        Alert.alert(
          'Mise à jour disponible',
          'Une nouvelle version est disponible.',
          [
            { text: 'Plus tard', style: 'cancel' },
            {
              text: 'Mettre à jour',
              onPress: () => {
                const storeUrl = Platform.select({
                  ios: 'https://apps.apple.com/app/YOUR_APP_ID',
                  android: 'https://play.google.com/store/apps/details?id=YOUR_PACKAGE',
                });
                if (storeUrl) Linking.openURL(storeUrl);
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error('Check store update error:', error);
    }
  };
  
  return { checkStoreUpdate };
}

function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;
    
    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }
  
  return 0;
}
```

### 14. Endpoint Backend pour Vérifier la Version
**Ajout:** API pour gérer les versions de l'app

```typescript
// Backend: controllers/appController.ts
import { Request, Response } from 'express';

interface AppVersion {
  platform: 'ios' | 'android';
  latestVersion: string;
  minimumVersion: string;
  forceUpdate: boolean;
  releaseNotes: string;
}

// Stocker dans la DB ou en config
const APP_VERSIONS: Record<string, AppVersion> = {
  ios: {
    platform: 'ios',
    latestVersion: '1.2.0',
    minimumVersion: '1.0.0',
    forceUpdate: false,
    releaseNotes: 'Nouvelles fonctionnalités et corrections de bugs',
  },
  android: {
    platform: 'android',
    latestVersion: '1.2.0',
    minimumVersion: '1.0.0',
    forceUpdate: false,
    releaseNotes: 'Nouvelles fonctionnalités et corrections de bugs',
  },
};

export const getAppVersion = async (req: Request, res: Response) => {
  try {
    const platform = req.query.platform as 'ios' | 'android';
    
    if (!platform || !['ios', 'android'].includes(platform)) {
      res.status(400).json({ message: 'Platform required (ios or android)' });
      return;
    }
    
    const versionInfo = APP_VERSIONS[platform];
    res.json(versionInfo);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};
```

### 15. Système de Synchronisation Offline
**Ajout:** Queue pour les actions offline

```typescript
// Frontend: services/offlineQueue.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

interface QueuedAction {
  id: string;
  type: 'send_message' | 'join_activity' | 'like_activity';
  payload: any;
  timestamp: number;
  retries: number;
}

class OfflineQueue {
  private queue: QueuedAction[] = [];
  private processing = false;

  async init() {
    const stored = await AsyncStorage.getItem('offline_queue');
    if (stored) {
      this.queue = JSON.parse(stored);
    }
  }

  async add(type: QueuedAction['type'], payload: any) {
    const action: QueuedAction = {
      id: `${type}-${Date.now()}`,
      type,
      payload,
      timestamp: Date.now(),
      retries: 0,
    };

    this.queue.push(action);
    await this.save();
  }

  async process() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    while (this.queue.length > 0) {
      const action = this.queue[0];

      try {
        await this.executeAction(action);
        this.queue.shift(); // Retirer si succès
      } catch (error) {
        action.retries++;
        
        if (action.retries >= 3) {
          this.queue.shift(); // Abandonner après 3 tentatives
        } else {
          break; // Réessayer plus tard
        }
      }

      await this.save();
    }

    this.processing = false;
  }

  private async executeAction(action: QueuedAction) {
    switch (action.type) {
      case 'send_message':
        // Envoyer le message
        break;
      case 'join_activity':
        // Rejoindre l'activité
        break;
      // ... autres actions
    }
  }

  private async save() {
    await AsyncStorage.setItem('offline_queue', JSON.stringify(this.queue));
  }
}

export const offlineQueue = new OfflineQueue();
```

## 📊 MÉTRIQUES À AJOUTER

### 16. Monitoring des Performances
```typescript
// Frontend: services/analytics.ts
export const trackPerformance = {
  apiCall: (endpoint: string, duration: number) => {
    if (duration > 2000) {
      console.warn(`Slow API call: ${endpoint} took ${duration}ms`);
    }
  },
  
  screenLoad: (screenName: string, duration: number) => {
    console.log(`Screen ${screenName} loaded in ${duration}ms`);
  },
  
  socketLatency: (event: string, latency: number) => {
    if (latency > 1000) {
      console.warn(`High socket latency: ${event} took ${latency}ms`);
    }
  },
};
```

## 🎯 PRIORITÉS D'IMPLÉMENTATION

1. **Urgent (Cette semaine):**
   - Problème #1: Race condition messages
   - Problème #4: Multiple déconnexions
   - Problème #2: Désynchronisation unreadCount

2. **Important (Ce mois):**
   - Problème #3: Cache activités
   - Problème #5: Statut modération
   - Amélioration #13: Système de mise à jour

3. **Nice to have (Futur):**
   - Amélioration #10: Optimistic UI étendu
   - Amélioration #11: Pagination infinie
   - Amélioration #15: Queue offline
