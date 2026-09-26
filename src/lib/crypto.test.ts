import { describe, expect, it } from "vitest";
import { decrypt, decryptJson, encrypt, encryptJson, pkceChallenge } from "./crypto";

describe("crypto", () => {
  it("round-trips and uses a fresh IV each time", () => {
    const a = encrypt("secret token");
    expect(decrypt(a)).toBe("secret token");
    expect(encrypt("secret token")).not.toBe(a);
    expect(decryptJson(encryptJson({ n: 1 }))).toEqual({ n: 1 });
  });

  it("rejects tampered ciphertext", () => {
    const parts = encrypt("secret").split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decrypt(parts.join("."))).toThrow();
  });

  it("computes the RFC 7636 S256 challenge", () => {
    expect(pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
});
