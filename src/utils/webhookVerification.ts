import crypto from 'crypto';

const NABOO_WEBHOOK_SECRET = process.env.NABOO_WEBHOOK_SECRET || '';

/**
 * Verify NabooPay webhook signature using HMAC-SHA256
 * @param payload - The raw webhook payload as string
 * @param signature - The signature from the webhook header
 * @returns boolean indicating if the signature is valid
 */
export const verifyWebhookSignature = (payload: string, signature: string): boolean => {
  if (!NABOO_WEBHOOK_SECRET) {
    console.error('[Webhook] NABOO_WEBHOOK_SECRET is not configured');
    return false;
  }

  if (!signature) {
    console.error('[Webhook] No signature provided');
    return false;
  }

  try {
    // Create HMAC with SHA256
    const hmac = crypto.createHmac('sha256', NABOO_WEBHOOK_SECRET);
    hmac.update(payload);
    const computedSignature = hmac.digest('hex');

    // Timing-safe comparison
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(computedSignature)
    );

    if (!isValid) {
      console.warn('[Webhook] Signature mismatch');
      console.warn('[Webhook] Expected:', computedSignature);
      console.warn('[Webhook] Received:', signature);
    }

    return isValid;
  } catch (error) {
    console.error('[Webhook] Error verifying signature:', error);
    return false;
  }
};

export default {
  verifyWebhookSignature,
};
