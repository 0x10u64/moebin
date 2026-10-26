import { queryElement } from "./util.js";

document.addEventListener("DOMContentLoaded", () => {
  const els = {
    form: queryElement("#paste-form", HTMLFormElement),
    textArea: queryElement("#text", HTMLTextAreaElement),
    expiresIn: queryElement("#expires-in", HTMLInputElement),
    status: queryElement("#status", HTMLElement),
    result: queryElement("#result", HTMLElement),
    shareLink: queryElement("#share-link", HTMLInputElement),
    deleteKey: queryElement("#delete-key", HTMLInputElement),
    copyShareLink: queryElement("#copy-share-link", HTMLButtonElement),
    copyDeleteKey: queryElement("#copy-delete-key", HTMLButtonElement),
  };

  els.form.reset();

  /**
   * @param {HTMLInputElement} input
   * @param {HTMLButtonElement} button
   */
  async function copyValue(input, button) {
    try {
      await navigator.clipboard.writeText(input.value);
      button.textContent = "Copied";
      setTimeout(() => {
        button.textContent = "Copy";
      }, 1000);
    } catch (error) {
      els.status.hidden = false;
      els.status.textContent =
        error instanceof Error
          ? `Could not copy to clipboard: ${error.message}`
          : "Could not copy to clipboard";
    }
  }

  els.copyShareLink.addEventListener("click", () => {
    void copyValue(els.shareLink, els.copyShareLink);
  });
  els.copyDeleteKey.addEventListener("click", () => {
    void copyValue(els.deleteKey, els.copyDeleteKey);
  });

  /**
   * @param {Uint8Array<ArrayBuffer>} bytes
   */
  function toBase64(bytes) {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
  }

  /**
   * @param {Uint8Array<ArrayBuffer>} bytes
   */
  function toBase64Url(bytes) {
    return toBase64(bytes)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  els.form.addEventListener(
    "submit",
    /** @param {Event} event */
    async (event) => {
      event.preventDefault();

      els.result.hidden = true;
      els.status.hidden = true;

      try {
        const expiresIn = els.expiresIn.valueAsNumber;
        if (
          !Number.isInteger(expiresIn) ||
          expiresIn < 1 ||
          expiresIn > 92160
        ) {
          throw new Error(
            "Expiration time must be between 1 and 92,160 minutes",
          );
        }

        const encoded = new TextEncoder().encode(els.textArea?.value);

        const paddedSize = Math.ceil(encoded.length / 1024) * 1024;
        const padded = new Uint8Array(paddedSize);
        new DataView(padded.buffer).setUint32(0, encoded.length, true);
        padded.set(encoded, 4);

        const rawKey = crypto.getRandomValues(new Uint8Array(32));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const key = await crypto.subtle.importKey(
          "raw",
          rawKey,
          "AES-GCM",
          false,
          ["encrypt"],
        );

        const data = new Uint8Array(
          await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, padded),
        );

        els.status.hidden = false;
        els.status.textContent = "Uploading...";

        const response = await fetch("/api/pastes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ciphertext: { iv: toBase64(iv), data: toBase64(data) },
            expiresIn,
          }),
        });

        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.error || "Could not save paste");
        }

        const url = new URL("/paste.html", location.origin);
        url.hash = `${body.id}.${toBase64Url(rawKey)}`;

        els.status.hidden = true;
        els.shareLink.value = url.href;
        els.deleteKey.value = body.deleteKey;
        els.result.hidden = false;
      } catch (error) {
        els.status.appendChild(document.createTextNode("Fail"));
        els.status.appendChild(document.createElement("br"));

        els.status.appendChild(
          document.createTextNode(
            error instanceof Error ? error.message : "Unkown error",
          ),
        );
        els.status.appendChild(document.createElement("br"));
      }
    },
  );
});
