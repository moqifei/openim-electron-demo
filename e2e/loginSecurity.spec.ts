import { expect, test } from "@playwright/test";
import fs from "node:fs";

const read = (file: string) => fs.readFileSync(file, "utf8");

test("uses a one-time challenge and AES-GCM credential for AD login", () => {
  const login = read("src/api/login.ts");
  const crypto = read("src/utils/adLoginCrypto.ts");
  const config = read("src/config/adLoginCrypto.ts");
  expect(login).toContain('"/account/login/ad/challenge"');
  expect(login).toContain("createEncryptedADLoginCredential");
  expect(login).toContain("{ credential }");
  expect(crypto).toContain('name: "AES-GCM"');
  expect(crypto).toContain("additionalData");
  expect(crypto).not.toContain("RSA-OAEP");
  expect(crypto).not.toContain("encryptedKey");
  expect(config).toContain("AD_LOGIN_SHARED_KEY");
});

test("revokes the server session before clearing local state", () => {
  const login = read("src/api/login.ts");
  const user = read("src/store/user.ts");
  expect(login).toContain('"/account/logout"');
  expect(user.indexOf("await logoutSession()")).toBeLessThan(user.indexOf("await IMSDK.logout()"));
  expect(user.indexOf("await logoutSession()")).toBeLessThan(user.indexOf("await clearIMProfile()"));
});
