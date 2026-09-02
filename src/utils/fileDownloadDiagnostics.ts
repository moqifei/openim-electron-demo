type DownloadUrlLogDetails = {
  protocol: string;
  host: string;
  port: string;
  pathname: string;
};

type DownloadXhrLike = {
  readyState?: number;
  status?: number;
  statusText?: string;
  responseURL?: string;
  timeout?: number;
};

type DownloadProgressLike = {
  lengthComputable?: boolean;
  loaded?: number;
  total?: number;
};

const getUrlLogDetails = (value: string): DownloadUrlLogDetails => {
  try {
    const parsed = new URL(value);
    return {
      protocol: parsed.protocol,
      host: parsed.hostname,
      port: parsed.port || (parsed.protocol === "https:" ? "443" : "80"),
      pathname: parsed.pathname,
    };
  } catch {
    return {
      protocol: "",
      host: "",
      port: "",
      pathname: "<invalid-url>",
    };
  }
};

export const getDownloadUrlLogDetails = (url: string) => getUrlLogDetails(url);

export const getDownloadXhrDiagnostics = (
  xhr: DownloadXhrLike,
  progress: DownloadProgressLike | undefined,
  knownSize: number | undefined,
  online: boolean | undefined,
) => ({
  readyState: xhr.readyState ?? 0,
  status: xhr.status ?? 0,
  statusText: xhr.statusText || "",
  timeout: xhr.timeout ?? 0,
  responseUrl: xhr.responseURL ? getUrlLogDetails(xhr.responseURL) : "",
  loaded: progress?.loaded ?? 0,
  total: progress?.lengthComputable ? progress.total ?? 0 : knownSize ?? 0,
  lengthComputable: Boolean(progress?.lengthComputable),
  online,
});

export const getDownloadErrorDiagnostics = (error: unknown) => {
  if (error instanceof Error) {
    const code = (error as Error & { code?: unknown }).code;
    return {
      name: error.name,
      message: error.message,
      ...(typeof code === "string" ? { code } : {}),
    };
  }

  if (typeof error === "string") return { name: "Error", message: error };
  return { name: "UnknownError", message: String(error) };
};
