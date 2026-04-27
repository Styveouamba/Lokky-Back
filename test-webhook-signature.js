/**
 * Script de test pour vérifier la signature webhook NabooPay
 * Usage: node test-webhook-signature.js
 */

const crypto = require('crypto');

// Configuration
const SECRET_KEY = 'c7ae62708d016961775d8103ffab1d2e1777338ea08aa9b62009c26a9e551990';

// Exemple de payload NabooPay V2
const payload = {
  "order_id": "2e3422f1-f8b9-4e59-bd34-8a29155e978a",
  "method_of_payment": ["wave"],
  "selected_payment_method": "wave",
  "amount": 100,
  "fees": 0,
  "currency": "XOF",
  "customer": {
    "first_name": "Carly",
    "last_name": "",
    "email": "styve@gmail.com"
  },
  "transaction_status": "completed",
  "products": [
    {
      "name": "Lokky Premium - Mensuel",
      "price": 100,
      "quantity": 1,
      "description": "Abonnement premium mensuel avec essai gratuit de 7 jours"
    }
  ],
  "is_escrow": false,
  "is_merchant": false,
  "fees_customer_side": false,
  "success_url": "https://lokky-back-teff.onrender.com/subscription/success?subscriptionId=69ef612440917ac95a28e2d7",
  "error_url": "https://lokky-back-teff.onrender.com/subscription/error?subscriptionId=69ef612440917ac95a28e2d7",
  "created_at": "2026-04-27T13:14:00Z",
  "updated_at": "2026-04-27T13:14:40Z",
  "paid_at": "2026-04-27T13:14:40Z"
};

// Générer la signature (comme NabooPay le fait)
function generateSignature(payload, secretKey) {
  const payloadString = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(payloadString)
    .digest('hex');
  return signature;
}

// Vérifier la signature (comme notre backend le fait)
function verifySignature(payload, signature, secretKey) {
  const payloadString = JSON.stringify(payload);
  const expectedSignature = crypto
    .createHmac('sha256', secretKey)
    .update(payloadString)
    .digest('hex');
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    return false;
  }
}

// Test
console.log('=== Test de signature webhook NabooPay ===\n');
console.log('Payload:', JSON.stringify(payload, null, 2));
console.log('\n--- Génération de signature ---');

const signature = generateSignature(payload, SECRET_KEY);
console.log('Signature générée:', signature);

console.log('\n--- Vérification de signature ---');
const isValid = verifySignature(payload, signature, SECRET_KEY);
console.log('Signature valide:', isValid ? '✅ OUI' : '❌ NON');

console.log('\n--- Test avec mauvaise signature ---');
const badSignature = 'bad_signature_123';
const isInvalid = verifySignature(payload, badSignature, SECRET_KEY);
console.log('Mauvaise signature rejetée:', !isInvalid ? '✅ OUI' : '❌ NON');

console.log('\n=== Test terminé ===');
