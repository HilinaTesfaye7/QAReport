export const CryptoService = {
  /**
   * Hashes a password using SHA-256.
   * This is a simple implementation for client-side hashing.
   * In a real production backend, bcrypt or Argon2 should be used.
   */
  hashPassword: async (password: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  },

  /**
   * Generates a random reset token.
   */
  generateResetToken: (): string => {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
};
