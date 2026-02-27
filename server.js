import { serve, file, write } from "bun";

const fq_port = 4466;
const fq_host = "v6.frontql.dev";
const auth_host = "auth.frontql.dev";

const BASIC_AUTHS = {};

const CORS_HEADERS = {
  headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "*",
    "Access-Control-Allow-Headers": "*",
  },
};

async function getBasicAuthFor(app) {
  const url = "https://" + auth_host;

  const body = {
    app: app,
    username: "arodos",
    password: "Ar0d0s@2024",
  };
  const response = await fetch(url + "/login", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const responseJson = await response.json();

  if (responseJson.err) {
    console.error("Invalid FrontQL credential");
    return undefined;
  }

  return "Basic " + responseJson.result;
}

serve({
  port: fq_port,
  async fetch(req) {
    if (req.method === "OPTIONS") {
      return new Response("Departed", CORS_HEADERS);
    }

    const app = req.headers.get("app");
    const key = req.headers.get("token-key");
    const path = "/tokens.json";

    if (!app || !key || !path) {
      return new Response(
        JSON.stringify({
          err: true,
          result: "Use updated Api.ts -> app, key or path is missing",
        }),
        CORS_HEADERS,
      );
    }

    const url = new URL(req.url);
    const method = req.method;
    const bodyText = await req.text();

    if (typeof BASIC_AUTHS[app] === "undefined") {
      BASIC_AUTHS[app] = await getBasicAuthFor(app);
    }

    const tokensFile = file("./tokens.json");
    const tokens = await tokensFile.json();

    url.port = 443;
    url.protocol = "https:";
    url.hostname = fq_host;
    req.headers.delete("host");
    req.headers.set("Accept-Encoding", "br");
    req.headers.append("Authorization", BASIC_AUTHS[app]);

    const response = await fetch(url, {
      method: method,
      body: bodyText,
      headers: req.headers,
    });
    const body = await response.json();
    if (key && body?.token) {
      tokens[key] = body.token;
      await write(tokensFile, JSON.stringify(tokens, null, 2));
    }
    return new Response(JSON.stringify(body), CORS_HEADERS);
  },
});

console.log(`FrontQL dev server is running on http://localhost:${fq_port}`);
