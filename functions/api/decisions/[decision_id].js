import { optionsResponse, proxyToSupabase } from "../../_supabase-proxy.js";

export async function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestGet(context) {
  return proxyToSupabase(context, `/api/decisions/${encodeURIComponent(context.params.decision_id)}`);
}
