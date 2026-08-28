import { createHash } from "node:crypto";
import semver from "semver";

export type DebUpdateFile = {
  url: string;
  sha512: string;
  size?: number;
};

export type DebUpdateManifest = {
  version: string;
  files?: DebUpdateFile[];
  path?: string;
  sha512?: string;
  size?: number;
  releaseDate?: string;
};

const getArchitectureTokens = (arch: string) => {
  if (arch === "arm64") return ["arm64", "aarch64"];
  if (arch === "x64") return ["amd64", "x86_64", "x64"];
  return [arch];
};

export const getDebManifestUrl = (baseUrl: string, manifestName = "latest-linux.yml") =>
  new URL(manifestName, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString();

export const getDebUpdateFile = (
  manifest: DebUpdateManifest,
  arch: string,
): DebUpdateFile => {
  const files =
    manifest.files?.filter((file) => file.url.toLowerCase().endsWith(".deb")) ?? [];
  const legacyFile =
    manifest.path && manifest.sha512
      ? [{ url: manifest.path, sha512: manifest.sha512, size: manifest.size }]
      : [];
  const candidates = files.length > 0 ? files : legacyFile;
  const architectureTokens = getArchitectureTokens(arch);
  const matchedFile =
    candidates.find((file) =>
      architectureTokens.some((token) => file.url.toLowerCase().includes(token)),
    ) ?? (candidates.length === 1 ? candidates[0] : undefined);

  if (!matchedFile) {
    throw new Error(`No deb update file matched architecture ${arch}`);
  }
  if (!matchedFile.sha512) {
    throw new Error(`Deb update file ${matchedFile.url} has no sha512`);
  }
  return matchedFile;
};

export const isNewerVersion = (
  currentVersion: string,
  candidateVersion: string,
  allowPrerelease = false,
) => {
  const current = semver.valid(currentVersion);
  const candidate = semver.valid(candidateVersion);
  if (!current || !candidate) return false;
  if (!allowPrerelease && semver.prerelease(candidate)) return false;
  return semver.gt(candidate, current);
};

export const verifySha512 = (data: Buffer, expectedSha512: string) => {
  const digest = createHash("sha512").update(data).digest();
  return verifySha512Digest(
    digest.toString("base64"),
    digest.toString("hex"),
    expectedSha512,
  );
};

export const verifySha512Digest = (
  base64Digest: string,
  hexDigest: string,
  expectedSha512: string,
) => {
  const expected = expectedSha512.trim();
  return base64Digest === expected || hexDigest === expected.toLowerCase();
};
