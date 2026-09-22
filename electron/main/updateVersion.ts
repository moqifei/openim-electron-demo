import * as semver from "semver";

export const isForceUpdateRequired = (
  currentVersion: string,
  latestVersion: string,
) => {
  const current = semver.parse(currentVersion);
  const latest = semver.parse(latestVersion);
  if (!current || !latest || !semver.gt(latest, current)) return false;

  return latest.patch - current.patch >= 2;
};
