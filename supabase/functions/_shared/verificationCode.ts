const textEncoder = new TextEncoder();

export async function hashVerificationCode(code: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(code));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
