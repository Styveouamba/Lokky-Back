# Configuration Webhook NabooPay

## Changements effectués

### 1. Correction du format webhook (V2)
- ✅ Header de signature: `X-Signature` (au lieu de x-naboo-signature)
- ✅ Champ status: `transaction_status` (au lieu de status)
- ✅ Champ ID: `order_id` (au lieu de transaction_id)
- ✅ Valeurs status: `completed`, `pending`, `failed` (au lieu de success/failed)

### 2. Vérification de signature
- ✅ Utilise HMAC SHA256 avec le secret webhook
- ✅ Compare avec le header `X-Signature`
- ✅ Mode développement: skip la vérification mais teste quand même pour debug
- ✅ Mode production: rejette les webhooks sans signature valide

### 3. Recherche de transaction
- ✅ Recherche par `order_id` (nabooTransactionId)
- ✅ Fallback: recherche par montant si transaction pending récente
- ✅ Mise à jour du nabooTransactionId si trouvé par fallback

### 4. Idempotence
- ✅ Vérifie si webhook déjà traité (webhookReceived flag)
- ✅ Retourne 200 OK si déjà traité

## Configuration requise dans NabooPay Dashboard

### URL du webhook
```
https://lokky-back-teff.onrender.com/api/webhooks/naboo-payment
```

### Secret webhook
Le secret est déjà configuré dans `.env`:
```
NABOO_WEBHOOK_SECRET=c7ae62708d016961775d8103ffab1d2e1777338ea08aa9b62009c26a9e551990
```

⚠️ **Important**: Ce secret doit correspondre exactement au secret configuré dans le dashboard NabooPay.

## Étapes de déploiement

1. **Rebuild le backend**
   ```bash
   npm run build
   ```

2. **Redéployer sur Render**
   - Push les changements sur Git
   - Render va automatiquement rebuild et redéployer

3. **Tester le webhook**
   - Faire un nouveau paiement test (100 FCFA)
   - Vérifier les logs pour voir:
     - `[Webhook] Received NabooPay webhook`
     - `[Webhook] Signature found: Yes` (si NabooPay envoie la signature)
     - `[Webhook] Processing payment: { order_id: '...', transaction_status: 'completed', ... }`
     - `[Webhook] ✅ Payment processed successfully`

4. **Vérifier l'activation**
   - Après paiement, l'utilisateur devrait voir le badge premium
   - Vérifier dans la base de données que:
     - Transaction status = 'completed'
     - Subscription status = 'trial'
     - User premium.isActive = true

## Troubleshooting

### Webhook ne reçoit pas de signature
Si NabooPay n'envoie pas le header `X-Signature`:
1. Vérifier dans le dashboard NabooPay que le webhook est bien configuré
2. Vérifier que le secret webhook est bien défini
3. Contacter le support NabooPay si nécessaire

En attendant, le mode développement permet de traiter les webhooks sans signature.

### Signature invalide
Si la signature est rejetée:
1. Vérifier que `NABOO_WEBHOOK_SECRET` correspond au secret du dashboard
2. Vérifier les logs pour voir la signature attendue vs reçue
3. S'assurer que le payload JSON est bien compact (pas d'espaces)

### Transaction non trouvée
Si le webhook ne trouve pas la transaction:
1. Vérifier que `order_id` du webhook correspond au `nabooTransactionId` de la transaction
2. Le fallback recherche par montant devrait fonctionner
3. Vérifier les logs pour voir les détails

## Prochaines étapes

Une fois que le webhook fonctionne automatiquement:
1. ✅ Supprimer le bouton debug du frontend (`activate-subscription-debug.tsx`)
2. ✅ Supprimer les routes debug du backend (`debugRoutes.ts`)
3. ✅ Passer `NODE_ENV=production` pour activer la vérification de signature
4. ✅ Augmenter les prix à 2,500 FCFA (mensuel) et 20,000 FCFA (annuel)
