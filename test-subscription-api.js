// Script de test pour l'API d'abonnement
const API_URL = process.env.API_URL || 'http://localhost:3000';
const TOKEN = process.argv[2]; // Pass token as argument

if (!TOKEN) {
  console.error('Usage: node test-subscription-api.js <YOUR_AUTH_TOKEN>');
  process.exit(1);
}

async function testSubscriptionAPI() {
  console.log('🧪 Testing Subscription API...\n');

  // Test 1: Get subscription status
  console.log('1️⃣ Testing GET /api/subscriptions/status');
  try {
    const response = await fetch(`${API_URL}/api/subscriptions/status`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
      },
    });
    const data = await response.json();
    console.log('✅ Status:', response.status);
    console.log('📦 Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  console.log('\n---\n');

  // Test 2: Initiate purchase
  console.log('2️⃣ Testing POST /api/subscriptions/initiate');
  try {
    const response = await fetch(`${API_URL}/api/subscriptions/initiate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        plan: 'monthly',
        paymentMethod: 'wave',
      }),
    });
    const data = await response.json();
    console.log('✅ Status:', response.status);
    console.log('📦 Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testSubscriptionAPI();
