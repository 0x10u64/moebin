import { queryElement } from "./util.js";

document.addEventListener("DOMContentLoaded", async () => {
  const els = {
    content: queryElement("#content", HTMLPreElement),
    status: queryElement("#status", HTMLElement),
    deleteForm: queryElement("#deleteForm", HTMLFormElement),
    deleteKey: queryElement("#delete-key", HTMLInputElement),
  };

  /**
   * @param {string} value
   * @returns {Uint8Array<ArrayBuffer>}
   */
  function fromBase64(value) {
    return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  }

  /**
   * @param {string} value
   * @returns {Uint8Array<ArrayBuffer>}
   */
  function fromBase64Url(value) {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    return fromBase64(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  }

  async function openPaste() {
    if (!location.hash) {
      els.status.hidden = false;
      els.status.textContent = "No paste provided";
      return;
    }

    els.status.hidden = false;
    els.status.textContent = "Loading paste...";

    try {
      const match = location.hash.slice(1).match(/^(.+)\.(.+)$/);
      if (!match) throw new Error();

      const [, id, encodedKey] = match;
      history.replaceState(
        history.state,
        "",
        `${location.pathname}${location.search}#${id}.0`,
      );

      let response;
      try {
        response = await fetch(`/api/pastes/${encodeURIComponent(id)}`);
      } catch {
        els.status.hidden = false;
        els.status.textContent = "Network error. Please try again.";
        return;
      }

      if (!response.ok) {
        throw new Error();
      }

      const body = await response.json();
      const key = await crypto.subtle.importKey(
        "raw",
        fromBase64Url(encodedKey),
        "AES-GCM",
        false,
        ["decrypt"],
      );

      const padded = new Uint8Array(
        await crypto.subtle.decrypt(
          { name: "AES-GCM", iv: fromBase64(body.ciphertext.iv) },
          key,
          fromBase64(body.ciphertext.data),
        ),
      );

      const n = new DataView(
        padded.buffer,
        padded.byteOffset,
        padded.byteLength,
      ).getUint32(0, true);
      const plaintext = padded.subarray(4, 4 + n);

      els.status.textContent = "";

      els.content.hidden = false;
      els.content.textContent = new TextDecoder().decode(
        new Uint8Array(plaintext),
      );

      els.deleteForm.hidden = false;
      els.deleteForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        els.status.hidden = false;
        els.status.textContent = "Deleting paste...";

        try {
          const response = await fetch(
            `/api/pastes/${encodeURIComponent(id)}`,
            {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ deleteKey: els.deleteKey.value }),
            },
          );

          if (!response.ok) {
            const body = await response.json();
            throw new Error(body.error || "Could not delete paste");
          }

          els.content.hidden = true;
          els.deleteForm.hidden = true;
          els.status.textContent = "Paste deleted";
        } catch (error) {
          els.status.textContent =
            error instanceof Error ? error.message : "Could not delete paste";
        }
      });
    } catch {
      els.status.hidden = false;
      els.status.textContent = "This paste can't be opened";
    }
  }

  await openPaste();
});
