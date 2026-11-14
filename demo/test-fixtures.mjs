import { mock } from "node:test";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import { firebaseConfig } from "./firebase-config.js";

const { publicKey, privateKey } = await generateKeyPair("RS256");
export const testKey = publicKey;
const jwk = { ...await exportJWK(publicKey), kid: "test-only", alg: "RS256", use: "sig" };

export function mockFirebaseKeys() {
  mock.method(globalThis, "fetch", async url => {
    if (String(url) !== "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com") throw new Error("Unexpected network request in test");
    return Response.json({ keys: [jwk] });
  });
}

export function testToken(overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ sub: "test-user", email: "test@example.test", auth_time: now, iat: now, exp: now + 3600, aud: firebaseConfig.projectId, iss: `https://securetoken.google.com/${firebaseConfig.projectId}`, firebase: { sign_in_provider: "password" }, ...overrides }).setProtectedHeader({ alg: "RS256", kid: "test-only" }).sign(privateKey);
}
