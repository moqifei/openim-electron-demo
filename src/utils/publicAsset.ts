const normalizeBase = (base: string) => (base.endsWith("/") ? base : `${base}/`);

export const publicAsset = (path: string) => {
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  return `${normalizeBase(import.meta.env.BASE_URL)}${normalizedPath}`;
};

