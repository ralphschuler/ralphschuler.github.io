import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const {
  buildLanguageUrls,
  enhanceLocalizedHtml,
} = require("../scripts/localization.js");

test("language URLs preserve corresponding routes", () => {
  assert.deepEqual(
    buildLanguageUrls("https://nyphon.de/en/about/", "en"),
    {
      canonical: "https://nyphon.de/en/about/",
      de: "https://nyphon.de/about/",
      en: "https://nyphon.de/en/about/",
    },
  );
  assert.deepEqual(
    buildLanguageUrls(
      "https://nyphon.de/categories/Projektupdates/",
      "de",
    ),
    {
      canonical: "https://nyphon.de/categories/Projektupdates/",
      de: "https://nyphon.de/categories/Projektupdates/",
      en: "https://nyphon.de/en/categories/Project-updates/",
    },
  );
});

test("localized metadata and route-aware language switches are injected", () => {
  const html = `<!doctype html><html><head><meta property="og:url" content="https://nyphon.de/en/projects/"></head><body><a href="https://nyphon.de/">DE</a><a href="https://nyphon.de/en/">EN</a></body></html>`;
  const output = enhanceLocalizedHtml(html, "en");

  assert.match(
    output,
    /<link rel="canonical" href="https:\/\/nyphon\.de\/en\/projects\/">/,
  );
  assert.match(
    output,
    /hreflang="de" href="https:\/\/nyphon\.de\/projects\/"/,
  );
  assert.match(
    output,
    /href="https:\/\/nyphon\.de\/en\/projects\/" lang="en"/,
  );
});
