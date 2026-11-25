export async function isValidSignature(rawBody: string, header: string | null, appSecret: string) {
  const hex = header?.match(/^sha256=([0-9a-f]{64})$/i)?.[1];
  if (!hex) return false;

  const signature = Uint8Array.from(hex.match(/../g)!, (byte) => parseInt(byte, 16));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify("HMAC", key, signature, new TextEncoder().encode(rawBody));
}
