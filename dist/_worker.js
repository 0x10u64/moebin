import { pastes } from "../src/pastes";

export default {
  /**
   * @param {Request} request
   * @param {any} env
   * @returns {Promise<Response>}
   */
  async fetch(request, env) {
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
