import axios, { AxiosError } from 'axios';

interface NabooPaymentRequest {
  method_of_payment: string[];
  products: {
    name: string;
    price: number;
    quantity: number;
    description?: string;
  }[];
  success_url: string;
  error_url: string;
  fees_customer_side: boolean;
  is_escrow: boolean;
  customer?: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    email?: string;
  };
  metadata?: {
    subscriptionId: string;
    userId: string;
    plan: string;
  };
}

interface NabooPaymentResponse {
  order_id: string;
  amount: number;
  method_of_payment: string[];
  currency: string;
  created_at: string;
  transaction_status: string;
  checkout_url: string;
  customer?: any;
  is_escrow: boolean;
  is_merchant: boolean;
}

const NABOO_API_KEY = process.env.NABOO_API_KEY;
const NABOO_API_URL = process.env.NABOO_API_URL || 'https://api.naboopay.com';
const NABOO_SANDBOX_MODE = process.env.NABOO_SANDBOX_MODE === 'true';
const NABOO_MOCK_MODE = process.env.NABOO_MOCK_MODE === 'true'; // Mode simulation pour tests
const API_URL = process.env.API_URL || 'http://localhost:3000';
const APP_URL = process.env.APP_URL || 'lokky://';

// Log configuration on startup
console.log('[NabooPay] Configuration:', {
  apiUrl: NABOO_API_URL,
  sandboxMode: NABOO_SANDBOX_MODE,
  mockMode: NABOO_MOCK_MODE,
  hasApiKey: !!NABOO_API_KEY,
  apiKeyPrefix: NABOO_API_KEY?.substring(0, 15) + '...',
});

export const initializePayment = async (
  amount: number,
  currency: string,
  paymentMethod: string,
  customerEmail: string,
  customerName: string,
  subscriptionId: string,
  userId: string,
  plan: string
): Promise<NabooPaymentResponse> => {
  try {
    console.log('[NabooPay] Initializing payment:', {
      amount,
      currency,
      paymentMethod,
      subscriptionId,
      plan,
      sandboxMode: NABOO_SANDBOX_MODE,
    });

    // Split customer name into first and last name
    const nameParts = customerName.split(' ');
    const firstName = nameParts[0] || 'User';
    const lastName = nameParts.slice(1).join(' ') || '';

    const payload: NabooPaymentRequest = {
      method_of_payment: [paymentMethod],
      products: [
        {
          name: `Lokky Premium - ${plan === 'monthly' ? 'Mensuel' : 'Annuel'}`,
          price: amount,
          quantity: 1,
          description: `Abonnement premium ${plan === 'monthly' ? 'mensuel' : 'annuel'} avec essai gratuit de 7 jours`,
        },
      ],
      success_url: `${APP_URL}subscription/success`,
      error_url: `${APP_URL}subscription/cancel`,
      fees_customer_side: false,
      is_escrow: false,
      customer: {
        first_name: firstName,
        last_name: lastName,
        email: customerEmail,
      },
      metadata: {
        subscriptionId,
        userId,
        plan,
      },
    };

    console.log('[NabooPay] Request payload:', JSON.stringify(payload, null, 2));

    const response = await axios.post(
      `${NABOO_API_URL}/api/v2/transactions`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${NABOO_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000, // 10 second timeout
      }
    );

    console.log('[NabooPay] Payment initialized successfully:', {
      orderId: response.data.order_id,
      status: response.data.transaction_status,
      checkoutUrl: response.data.checkout_url,
    });

    return {
      order_id: response.data.order_id,
      amount: response.data.amount,
      method_of_payment: response.data.method_of_payment,
      currency: response.data.currency,
      created_at: response.data.created_at,
      transaction_status: response.data.transaction_status,
      checkout_url: response.data.checkout_url,
      customer: response.data.customer,
      is_escrow: response.data.is_escrow,
      is_merchant: response.data.is_merchant,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      console.error('[NabooPay] Payment initialization failed:', {
        status: axiosError.response?.status,
        data: axiosError.response?.data,
        message: axiosError.message,
      });

      // Retry logic for network errors
      if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
        console.log('[NabooPay] Retrying payment initialization...');
        // Implement exponential backoff retry here if needed
      }

      throw new Error(
        `NabooPay API error: ${JSON.stringify(axiosError.response?.data) || axiosError.message}`
      );
    }

    console.error('[NabooPay] Unexpected error:', error);
    throw new Error('Failed to initialize payment with NabooPay');
  }
};

export default {
  initializePayment,
};
