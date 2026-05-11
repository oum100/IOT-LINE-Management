import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

type PasswordResetPayload = {
  email: string;
  exp: number;
  nonce: string;
};

function toBase64Url(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, "base64");
}

function sign(payloadPart: string, secret: string) {
  return createHmac("sha256", `${secret}:password-reset`).update(payloadPart).digest();
}

export function createPasswordResetToken(input: {
  email: string;
  secret: string;
  expiresInMinutes?: number;
}) {
  const expiresInMinutes = input.expiresInMinutes ?? 30;
  const payload: PasswordResetPayload = {
    email: input.email.toLowerCase().trim(),
    exp: Date.now() + expiresInMinutes * 60 * 1000,
    nonce: randomBytes(8).toString("hex"),
  };

  const payloadPart = toBase64Url(JSON.stringify(payload));
  const signaturePart = toBase64Url(sign(payloadPart, input.secret));
  return `${payloadPart}.${signaturePart}`;
}

export function verifyPasswordResetToken(input: { token: string; secret: string }) {
  const parts = input.token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error("Invalid reset token");
  }

  const payloadPart = parts[0];
  const signaturePart = parts[1];
  const expectedSignature = sign(payloadPart, input.secret);
  const actualSignature = fromBase64Url(signaturePart);

  if (
    expectedSignature.byteLength !== actualSignature.byteLength ||
    !timingSafeEqual(expectedSignature, actualSignature)
  ) {
    throw new Error("Invalid reset token signature");
  }

  const payload = JSON.parse(fromBase64Url(payloadPart).toString("utf8")) as PasswordResetPayload;
  if (!payload.email || !payload.exp) {
    throw new Error("Invalid reset token payload");
  }
  if (Date.now() > payload.exp) {
    throw new Error("Reset token has expired");
  }

  return {
    email: payload.email.toLowerCase().trim(),
    expiresAt: new Date(payload.exp),
  };
}
