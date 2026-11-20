import { defineConfig } from 'vite';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

// Every .html file in the project root is a page, so new pages just work:
// index.html -> /   about.html -> /about   (clean URLs come from vercel.json)
const pages = Object.fromEntries(
  readdirSync(root)
    .filter((file) => file.endsWith('.html'))
    .map((file) => [file.slice(0, -'.html'.length), resolve(root, file)]),
);

export default defineConfig({
  build: {
    rolldownOptions: { input: pages },
  },
});
