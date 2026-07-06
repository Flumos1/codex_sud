import { handleSearch, queryFromSearchParams } from "../scripts/api-core.mjs";
import { getData } from "./_data.mjs";
import { getSearchParams, methodNotAllowed, sendJson } from "./_respond.mjs";

export default async function handler(request, response) {
  if (methodNotAllowed(request, response)) return;
  try {
    const { decisions } = await getData();
    const query = queryFromSearchParams(getSearchParams(request));
    const { status, payload } = handleSearch(decisions, query);
    sendJson(response, status, payload);
  } catch (error) {
    console.error("api/search error:", error);
    sendJson(response, 500, { error: "internal_error" });
  }
}
