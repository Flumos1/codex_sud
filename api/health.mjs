import { getData } from "./_data.mjs";
import { methodNotAllowed, sendJson } from "./_respond.mjs";

export default async function handler(request, response) {
  if (methodNotAllowed(request, response)) return;
  try {
    const { decisions } = await getData();
    sendJson(response, 200, { ok: true, source: "vercel-sample", decisions: decisions.length });
  } catch (error) {
    console.error("api/health error:", error);
    sendJson(response, 500, { error: "internal_error" });
  }
}
