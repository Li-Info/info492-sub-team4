import { createRemoteJWKSet, jwtVerify } from "jose";
import { HttpError } from "./rfi.mjs";
import { firebaseConfig } from "./firebase-config.js";

const firebaseKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));

export async function verifyFirebaseToken(token, key = firebaseKeys) {
  try {
    if (typeof token !== "string" || token.length > 16000) throw new Error();
    const { payload } = await jwtVerify(token, key, {
      issuer: `https://securetoken.google.com/${firebaseConfig.projectId}`,
      audience: firebaseConfig.projectId,
      algorithms: ["RS256"],
      requiredClaims: ["exp", "iat", "sub", "auth_time"],
    });
    const now = Math.floor(Date.now() / 1000);
    if (!payload.sub || payload.sub.length > 128 || typeof payload.auth_time !== "number" || payload.auth_time > now || typeof payload.iat !== "number" || payload.iat > now || typeof payload.email !== "string" || payload.firebase?.sign_in_provider !== "password") throw new Error();
    return payload;
  } catch (error) {
    if (error.status === 503) throw error;
    throw new HttpError(401, "Please sign in again with your email and password.");
  }
}
