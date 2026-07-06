import { handleDecision } from "../../scripts/api-core.mjs";
import { getData } from "../_data.mjs";
import { methodNotAllowed, sendJson } from "../_respond.mjs";

export default async function handler(request, response) {
  if (methodNotAllowed(request, response)) return;
  try {
    const { byId } = await getData();
    const { status, payload } = handleDecision(byId, decisionIdFrom(request));
    sendJson(response, status, payload);
  } catch (error) {
    console.error("api/decisions error:", error);
    sendJson(response, 500, { error: "internal_error" });
  }
}

function decisionIdFrom(request) {
  if (request.query && typeof request.query.id === "string") return request.query.id;
  const pathname = new URL(request.url || "/", "http://localhost").pathname;
  const segment = pathname.split("/").filter(Boolean).pop() || "";
  return decodeURIComponent(segment);
}
