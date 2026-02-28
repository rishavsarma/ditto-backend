import tokens from "../../tokens.json";

const FQ_APP_NAME = "trendingcut_test";
const FQ_DEV_SERVER_URL = "http://localhost:4466";
const FQ_PROD_SERVER_URL = "https://v6.frontql.dev";

const resolveProjectTokenPath = () => {
  if (typeof process === "undefined" || typeof process.cwd !== "function") {
    return "tokens.json";
  }

  const cwd = process.cwd().replace(/\\+$/g, "");
  return `${cwd}/tokens.json`;
};

const FQ_FULL_TOKEN_PATH = resolveProjectTokenPath();

interface Tokens {
  [key: string]: string | false;
}

function uniqueKey(input: string): string {
  let x = 5381;
  for (let i = 0; i < input.length; i++) {
    x = ((x << 5) + x) ^ input.charCodeAt(i);
  }
  let y;
  let key = "";
  for (let i = 0; i < 8; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    y = (x >>> 0) % 62;
    y = y < 10 ? 48 + y : y < 36 ? 87 + y : 29 + y;
    key += String.fromCharCode(y);
  }

  return key;
}

type HttpMethod = "get" | "post" | "put" | "delete" | "sql";

type RequestOptions = {
  loading?: boolean;
  body?:
    | {
        sql?: string;
        params?: Array<{ [key: string]: string | number }>;
      }
    | Record<string, unknown>;
  key?: string;
  page?: string | number;
  sort?: string;
  joins?: string;
  filter?: string;
  search?: string;
  nearby?: string;
  hidden?: string;
  fields?: string;
  session?: string;
  validation?: string;
  permissions?: string;
};

function cleanUrlPath(urlPath: string) {
  const urlPathArr = urlPath.split("/");
  if (urlPathArr.length > 2) {
    urlPathArr.pop();
  }
  return urlPathArr.join("/");
}

function getKey(method: HttpMethod, url: string, options: RequestOptions) {
  const _url = cleanUrlPath(url);

  const request: Record<string, unknown> = {
    fields: options?.fields,
    hidden: options?.hidden,
    filter: options?.filter,
    nearby: options?.nearby,
    collections: options?.joins,
    permissions: options?.permissions,
    validation: options?.validation,
  };

  request["body_is_array"] = Array.isArray(options.body || {});

  // Include body content for SQL queries and auth endpoints to ensure unique tokens
  if (options.body && typeof options.body === "object") {
    if ("sql" in options.body) {
      request["sql"] = options.body.sql;
    }
  }

  let tokenStr = method + ">" + _url;
  for (const key in request) {
    tokenStr += key + ":" + request[key];
  }
  return method + ":" + _url + ">" + uniqueKey(tokenStr);
}

const makeRequest = async <T = unknown>(
  method: HttpMethod,
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> => {
  const {
    body,
    page,
    sort,
    joins,
    hidden,
    fields,
    filter,
    search,
    nearby,
    session,
    validation,
    permissions,
    loading = true,
  } = options;

  const headers: Record<string, string> = {};
  if (hidden) headers.hidden = hidden;
  if (filter) headers.filter = filter;
  if (fields) headers.fields = fields;
  if (session) headers.session = session;
  if (nearby) headers.nearby = nearby;
  if (joins) headers.collections = joins;
  if (validation) headers.validation = validation;
  if (permissions) headers.permissions = permissions;

  const key = getKey(method, endpoint, options);
  const token = (tokens as Tokens)[key] || false;

  if (token) {
    headers["token"] = token;
  } else {
    headers["token-key"] = key;
    headers["token-path"] = FQ_FULL_TOKEN_PATH;
  }

  const params: { [key: string]: string } = {};

  if (page !== undefined) params.page = String(page);
  if (sort) params.sort = sort;
  if (search) params.search = search;

  try {
    if (loading) {
    }
    const requestConfig: RequestInit = {
      method: method.toUpperCase(),
      headers: {
        ...headers,
        "Content-Type": "application/json",
        app: FQ_APP_NAME,
      },
      body: body ? JSON.stringify(body) : undefined,
    };

    let url = endpoint;
    if (Object.keys(params).length > 0) {
      const query = new URLSearchParams(params);
      url += `?${query.toString()}`;
    }

    const final_url = token
      ? FQ_PROD_SERVER_URL + url
      : FQ_DEV_SERVER_URL + url;

    const response = await fetch(final_url, requestConfig);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData?.message || `Error: ${response.statusText}`);
    }
    return (await response.json()) as T;
  } catch (error: unknown) {
    console.error(
      `${method.toUpperCase()} Error:`,
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  } finally {
    if (loading) {
      console.log("Loading completed.");
    }
  }
};

const Api = {
  get: async <T = unknown>(
    endpoint: string,
    options?: RequestOptions,
  ): Promise<T> => makeRequest<T>("get", endpoint, options),
  put: async <T = unknown>(
    endpoint: string,
    options?: RequestOptions,
  ): Promise<T> => makeRequest<T>("put", endpoint, options),
  post: async <T = unknown>(
    endpoint: string,
    options?: RequestOptions,
  ): Promise<T> => makeRequest<T>("post", endpoint, options),
  delete: async <T = unknown>(
    endpoint: string,
    options?: RequestOptions,
  ): Promise<T> => makeRequest<T>("delete", endpoint, options),
  sql: async <T = unknown>(
    endpoint: string,
    options?: RequestOptions,
  ): Promise<T> =>
    makeRequest<T>("post", `/sql-${endpoint.replace("/", "")}`, options),
};

export default Api;
