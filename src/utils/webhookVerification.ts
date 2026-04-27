import crypto from 'crypto';

const NABOO_WEBHOOK_SECRET = process.env.NABOO_WEBHOOK_SECRET;

/**
 * Verifies the webhook signature from NabooPay using HMAC-SHA256
 * @param payload - The raw webhook payload as a string
 * @param signature - The signature from the webhook header
 * @returns boolean indicating if the signature is valid
 */
export const verifyWebhookSignature = (
  payload: string,
  signature: string
): boolean => {
  try {
    if (!NABOO_WEBHOOK_SECRET) {
      console.error('[WebhookVerification] NABOO_WEBHOOK_SECRET not configured');
      return false;
    }

    if (!signature) {
      console.error('[WebhookVerification] No signature provided');
      return false;
    }

    console.log('[WebhookVerification] Verifying webhook signature...');

    // Compute HMAC-SHA256 signature
    const computedSignature = crypto
      .createHmac('sha256', NABOO_WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');

    // Timing-safe comparison to prevent timing attacks
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(computedSignature)
    );

    if (isValid) {
      console.log('[WebhookVerification] ✅ Signature valid');
    } else {
      console.error('[WebhookVerification] ❌ Signature invalid');
    }

    return isValid;
  } catch (error) {
    console.error('[WebhookVerification] Error verifying signature:', error);
    return false;
  }
};

export default {
  verifyWebhookSignature,
};
