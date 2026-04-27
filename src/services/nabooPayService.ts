import axios, { AxiosError } from 'axios';

interface NabooPaymentRequest {
  amount: number;
  currency: string;
  payment_method: string;
  customer_email: string;
  customer_name: string;
  return_url: string;
  cancel_url: string;
  webhook_url: string;
  metadata: {
    subscriptionId: string;
    userId: string;
    plan: string;
  };
}

interface NabooPaymentResponse {
  payment_url: string;
  transaction_id: string;
  status: string;
}

const NABOO_API_KEY = process.env.NABOO_API_KEY;
const NABOO_API_URL = process.env.NABOO_API_URL || 'https://api.naboopay.com';
const NABOO_SANDBOX_MODE = process.env.NABOO_SANDBOX_MODE === 'true';
const API_URL = process.env.API_URL || 'http://localhost:3000';
const APP_URL = process.env.APP_URL || 'lokky://';

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

    const payload: NabooPaymentRequest = {
      amount,
      currency,
      payment_method: paymentMethod,
      customer_email: customerEmail,
      customer_name: customerName,
      return_url: `${APP_URL}subscription/success`,
      cancel_url: `${APP_URL}subscription/cancel`,
      webhook_url: `${API_URL}/api/webhooks/naboo-payment`,
      metadata: {
        subscriptionId,
        userId,
        plan,
      },
    };

    const response = await axios.post(
      `${NABOO_API_URL}/v2/payments/initialize`,
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
      transactionId: response.data.transaction_id,
      status: response.data.status,
    });

    return {
      payment_url: response.data.payment_url,
      transaction_id: response.data.transaction_id,
      status: response.data.status,
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
        `NabooPay API error: ${axiosError.response?.data || axiosError.message}`
      );
    }

    console.error('[NabooPay] Unexpected error:', error);
    throw new Error('Failed to initialize payment with NabooPay');
  }
};

export default {
  initializePayment,
};
