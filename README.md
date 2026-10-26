# moebin

Simple encrypted text file hosting.

Text is encrypted in your browser with AES-GCM before upload; the decryption
key stays in the share link fragment and is never sent to the server.
Anyone with the complete link can read the paste, so don't use this for
passwords or other sensitive content. See more at the [main instance's FAQ page](https://moebin.pages.dev/faq).

## Run locally

Requires Node.js and a Cloudflare D1 database configured in `wrangler.json`.

```sh
npm install
npm run dev
```

## Deploy

Authenticate with Wrangler, then deploy the Pages site:

```sh
npx wrangler login
npm run deploy
```

The project expects a D1 database binding named `DB`.
