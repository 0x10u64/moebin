/**
 * @param {Request} req
 * @param {any} env
 * @returns {Promise<Response>}
 */
export async function pastes(req, env) {
  if (
    req.method !== "GET" &&
    req.method !== "POST" &&
    req.method !== "DELETE"
  ) {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "GET, POST, DELETE" },
    });
  }

  await env.DB.prepare(
    `
    CREATE TABLE IF NOT EXISTS pastes (
      id TEXT PRIMARY KEY,
      ciphertext TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      delete_token_hash TEXT NOT NULL
    )
  `,
  ).run();

  if (req.method === "POST") {
    const { ciphertext, expiresIn } = await req.json();
    if (
      !ciphertext ||
      typeof ciphertext.iv !== "string" ||
      typeof ciphertext.data !== "string"
    ) {
      return Response.json({ error: "Invalid ciphertext" }, { status: 400 });
    }

    if (
      typeof expiresIn !== "number" ||
      !Number.isInteger(expiresIn) ||
      expiresIn < 1 ||
      expiresIn > 92160
    ) {
      return Response.json(
        {
          error: "Expiration time must be between 1 and 92,160 minutes",
        },
        { status: 400 },
      );
    }

    const expiresAt = Date.now() + Math.ceil(expiresIn * 60000);
    if (!Number.isSafeInteger(expiresAt)) {
      return Response.json(
        { error: "Invalid expiration time" },
        { status: 400 },
      );
    }

    /**
     * @param {Uint8Array} bytes
     * @returns {string}
     */
    const toBase64Url = (bytes) => {
      return btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    };

    const id = toBase64Url(crypto.getRandomValues(new Uint8Array(16)));
    const deleteKey = btoa(
      String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))),
    );
    const deleteKeyHash = Array.from(
      new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(deleteKey),
        ),
      ),
      (byte) => byte.toString(16).padStart(2, "0"),
    ).join("");

    await env.DB.prepare(
      `INSERT INTO pastes (id, ciphertext, expires_at, delete_token_hash)
       VALUES (?, ?, ?, ?)`,
    )
      .bind(id, JSON.stringify(ciphertext), expiresAt, deleteKeyHash)
      .run();

    return Response.json({ id, deleteKey }, { status: 201 });
  }

  const id = new URL(req.url).pathname.split("/").pop();
  if (!id || id === "pastes") {
    return Response.json({ error: "Paste ID required" }, { status: 400 });
  }

  if (req.method === "DELETE") {
    const { deleteKey } = await req.json();
    if (typeof deleteKey !== "string") {
      return Response.json({ error: "Invalid delete key" }, { status: 400 });
    }

    const result = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(deleteKey),
    );
    const deleteKeyHash = Array.from(new Uint8Array(result), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");

    const deletion = await env.DB.prepare(
      "DELETE FROM pastes WHERE id = ? AND delete_token_hash = ? AND expires_at > ?",
    )
      .bind(id, deleteKeyHash, Date.now())
      .run();

    if (deletion.meta.changes === 0) {
      return Response.json(
        { error: "Paste not found or delete key is invalid" },
        { status: 404 },
      );
    }

    return new Response(null, { status: 204 });
  }

  const paste = await env.DB.prepare(
    "SELECT ciphertext, expires_at FROM pastes WHERE id = ?",
  )
    .bind(id)
    .first();

  if (!paste || (paste.expires_at !== null && paste.expires_at <= Date.now())) {
    if (paste) {
      await env.DB.prepare("DELETE FROM pastes WHERE id = ?").bind(id).run();
    }
    return Response.json({ error: "Paste not found" }, { status: 404 });
  }

  return Response.json({ ciphertext: JSON.parse(paste.ciphertext) });
}
