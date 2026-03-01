/**
 * Customer matching normalization — Wave 12
 *
 * Minimal normalization for matching inbound sender identifiers
 * to customer_delivery_info records.
 */

/**
 * Normalize email: trim + lowercase.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Normalize phone number for matching:
 * - Trim whitespace
 * - Remove spaces, dashes, dots, parentheses
 * - Dutch 06 → +316 conversion
 * - Dutch 0031 → +31 conversion
 * - Ensure starts with +
 */
export function normalizePhone(phone: string): string {
  // Trim and strip formatting characters
  let cleaned = phone.trim().replace(/[\s\-\.\(\)]/g, '');

  // Dutch 0031 prefix → +31
  if (cleaned.startsWith('0031')) {
    cleaned = '+31' + cleaned.slice(4);
  }

  // Dutch 06 prefix → +316
  if (cleaned.startsWith('06') && cleaned.length >= 10) {
    cleaned = '+31' + cleaned.slice(1);
  }

  // Dutch 6xxxxxxxx without prefix → +316xxxxxxxx
  if (cleaned.startsWith('6') && cleaned.length === 9) {
    cleaned = '+31' + cleaned;
  }

  // Ensure starts with +
  if (!cleaned.startsWith('+') && cleaned.length >= 10) {
    cleaned = '+' + cleaned;
  }

  return cleaned;
}

/**
 * Normalize sender identifier based on channel.
 */
export function normalizeSender(channel: string, identifier: string): string {
  if (channel === 'email') {
    return normalizeEmail(identifier);
  }
  if (channel === 'whatsapp') {
    return normalizePhone(identifier);
  }
  return identifier.trim();
}
