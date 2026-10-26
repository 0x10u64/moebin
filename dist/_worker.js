import { pastes } from "../src/pastes";

export default {
  /**
   * @param {Request} request
   * @param {any} env
   * @returns {Promise<Response>}
   */
  async fetch(request, env) {
    const ip = request.headers.get("CF-Connecting-IP");

    const { success: rlSuccess } = await env.RL.limit({ key: ip });
    if (!rlSuccess) {
      return new Response(null, { status: 429 });
    }

    const url = new URL(request.url);

    if (
      url.pathname === "/api/pastes" ||
      url.pathname.startsWith("/api/pastes/")
    ) {
      return pastes(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
