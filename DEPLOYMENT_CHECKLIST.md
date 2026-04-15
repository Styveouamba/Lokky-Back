# ✅ Checklist de Déploiement - Corrections Lokky

## 📋 Avant le Déploiement

### Backend
- [ ] Vérifier que `getUnreadCounts` est bien dans `messageController.ts`
- [ ] Vérifier que la route `/messages/unread-counts` est enregistrée
- [ ] Compiler le TypeScript: `npm run build`
- [ ] Vérifier qu'il n'y a pas d'erreurs de compilation
- [ ] Tester l'endpoint localement:
  ```bash
  curl -H "Authorization: Bearer YOUR_TOKEN" \
       http://localhost:3000/api/messages/unread-counts
  ```

### Frontend
- [ ] Vérifier que `pendingMessages` est dans `messageStore.ts`
- [ ] Vérifier que `syncUnreadCounts` est implémenté
- [ ] Vérifier que `logoutPromise` est dans `apiService.ts`
- [ ] Vérifier que `use-unread-sync.ts` existe
- [ ] Compiler: `npm run build` ou `expo prebuild`
- [ ] Vérifier qu'il n'y a pas d'erreurs TypeScript

## 🧪 Tests en Staging

### Test 1: Race Condition Messages
1. [ ] Ouvrir une conversation
2. [ ] Envoyer 5 messages rapidement
3. [ ] Vérifier qu'aucun doublon n'apparaît
4. [ ] Vérifier que tous les messages ont un vrai ID (pas temp-*)
5. [ ] Activer le throttling réseau (Slow 3G)
6. [ ] Envoyer un message
7. [ ] Vérifier le remplacement correct

**Résultat attendu:** Aucun doublon, tous les messages affichés correctement

### Test 2: Compteurs Non Lus
1. [ ] Avoir 2 comptes de test (A et B)
2. [ ] Compte B envoie 3 messages à A
3. [ ] Vérifier que A voit "3" non lus
4. [ ] Attendre 30 secondes
5. [ ] Vérifier que le compteur est toujours "3"
6. [ ] A ouvre la conversation
7. [ ] Vérifier que le compteur passe à "0"
8. [ ] Attendre 30 secondes
9. [ ] Vérifier que le compteur reste "0"

**Résultat attendu:** Compteurs toujours corrects, synchronisation automatique

### Test 3: Mutex Déconnexion
1. [ ] Modifier temporairement le JWT pour qu'il expire
2. [ ] Faire 5 requêtes API simultanées
3. [ ] Vérifier les logs backend
4. [ ] Vérifier qu'une seule déconnexion se produit
5. [ ] Vérifier qu'il n'y a pas d'erreurs en cascade

**Résultat attendu:** Une seule déconnexion, logs propres

## 📱 Tests Manuels Complets

### Scénario 1: Conversation Active
- [ ] Ouvrir une conversation
- [ ] Envoyer des messages
- [ ] Recevoir des messages
- [ ] Vérifier les compteurs
- [ ] Marquer comme lu
- [ ] Vérifier la synchronisation

### Scénario 2: Multiples Conversations
- [ ] Avoir 5 conversations avec messages non lus
- [ ] Vérifier les compteurs de chaque conversation
- [ ] Ouvrir une conversation
- [ ] Vérifier que seul son compteur passe à 0
- [ ] Attendre 30s
- [ ] Vérifier que tous les compteurs sont corrects

### Scénario 3: Connexion Instable
- [ ] Activer le mode avion
- [ ] Envoyer un message (devrait rester en attente)
- [ ] Désactiver le mode avion
- [ ] Vérifier que le message est envoyé
- [ ] Vérifier qu'il n'y a pas de doublon

### Scénario 4: Session Expirée
- [ ] Forcer l'expiration du token
- [ ] Faire plusieurs actions simultanées
- [ ] Vérifier qu'une seule déconnexion se produit
- [ ] Vérifier la redirection vers login

## 🔍 Monitoring Post-Déploiement

### Métriques à Surveiller (Premières 24h)

#### Backend
- [ ] Taux d'erreur sur `/messages/unread-counts`
- [ ] Temps de réponse de l'endpoint (devrait être < 200ms)
- [ ] Nombre d'appels à l'endpoint
- [ ] Erreurs 401 (ne devrait pas augmenter)

#### Frontend
- [ ] Erreurs JavaScript liées aux messages
- [ ] Plaintes utilisateurs sur doublons de messages
- [ ] Plaintes sur compteurs incorrects
- [ ] Crashs liés à la déconnexion

### Logs à Vérifier

Backend:
```bash
# Vérifier les appels à getUnreadCounts
grep "unread-counts" logs/app.log

# Vérifier les erreurs
grep "ERROR" logs/app.log | grep -i "message\|unread"
```

Frontend (Console):
```javascript
// Chercher ces messages
"[MessageStore] Received new_message"
"Sync unread counts"
"🔒 Logout already in progress"
```

## 🚨 Rollback Plan

Si des problèmes critiques apparaissent:

### Backend
```bash
# Revenir à la version précédente
git revert HEAD
npm run build
pm2 restart lokky-backend
```

### Frontend
```bash
# Revenir à la version précédente
git revert HEAD
expo publish  # Pour OTA
# ou rebuild pour version native
```

### Désactiver Temporairement

Si besoin de désactiver juste la synchronisation:

Dans `hooks/use-unread-sync.ts`:
```typescript
export function useUnreadSync() {
  // Désactivé temporairement
  return;
  
  // ... reste du code
}
```

## ✅ Validation Finale

Avant de marquer comme "Déployé":

- [ ] Tous les tests passent
- [ ] Aucune erreur dans les logs
- [ ] Métriques stables
- [ ] Pas de plaintes utilisateurs
- [ ] Performance acceptable
- [ ] Compteurs corrects
- [ ] Pas de doublons de messages
- [ ] Déconnexions propres

## 📊 Critères de Succès

### Semaine 1
- [ ] 0 rapport de doublons de messages
- [ ] 0 rapport de compteurs incorrects
- [ ] < 5 erreurs liées aux corrections
- [ ] Temps de réponse `/unread-counts` < 200ms
- [ ] Taux d'erreur < 0.1%

### Semaine 2-4
- [ ] Stabilité confirmée
- [ ] Métriques normales
- [ ] Feedback utilisateurs positif
- [ ] Prêt pour les prochaines améliorations

## 📞 Contacts en Cas de Problème

- **Backend:** [Votre équipe backend]
- **Frontend:** [Votre équipe frontend]
- **DevOps:** [Votre équipe DevOps]
- **On-call:** [Numéro d'urgence]

## 📝 Notes de Déploiement

**Date prévue:** _______________  
**Déployé par:** _______________  
**Version:** 1.0.0  
**Environnement:** Staging → Production

**Notes:**
- Ces corrections sont rétrocompatibles
- Pas de migration de base de données nécessaire
- Pas de breaking changes
- Déploiement backend d'abord, puis frontend

---

**Signature:** _______________  
**Date:** _______________
