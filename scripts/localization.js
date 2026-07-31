const SITE_ORIGIN = "https://nyphon.de";

function escapeAttribute(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildLanguageUrls(currentUrl, language) {
  const canonical = new URL(currentUrl, SITE_ORIGIN);
  canonical.hash = "";

  let route = canonical.pathname;
  if (language === "en") {
    route = route.replace(/^\/en(?=\/|$)/, "") || "/";
  }
  if (!route.startsWith("/")) route = `/${route}`;

  const dePath = route.replace(
    /^\/categories\/Project-updates(?=\/|$)/,
    "/categories/Projektupdates",
  );
  const enPath = route.replace(
    /^\/categories\/Projektupdates(?=\/|$)/,
    "/categories/Project-updates",
  );

  return {
    canonical: canonical.toString(),
    de: new URL(dePath, SITE_ORIGIN).toString(),
    en: new URL(`/en${enPath}`, SITE_ORIGIN).toString(),
  };
}

function enhanceLocalizedHtml(html, language, explicitCanonicalUrl) {
  const openGraphUrl = html.match(
    /<meta\s+property=["']og:url["']\s+content=["']([^"']+)["']\s*\/?>/i,
  )?.[1];
  const currentUrl = explicitCanonicalUrl || openGraphUrl;
  if (!currentUrl) return html;

  const urls = buildLanguageUrls(currentUrl, language);
  const headLinks = [
    `<link rel="canonical" href="${escapeAttribute(urls.canonical)}">`,
    `<link rel="alternate" hreflang="de" href="${escapeAttribute(urls.de)}">`,
    `<link rel="alternate" hreflang="en" href="${escapeAttribute(urls.en)}">`,
    `<link rel="alternate" hreflang="x-default" href="${escapeAttribute(urls.de)}">`,
  ].join("\n    ");

  let output = html;
  if (!/<link\s+rel=["']canonical["']/i.test(output)) {
    output = output.replace("</head>", `    ${headLinks}\n</head>`);
  }

  output = output
    .replace(
      /<a href="https:\/\/nyphon\.de\/">DE<\/a>/g,
      `<a href="${escapeAttribute(urls.de)}" lang="de" hreflang="de">DE</a>`,
    )
    .replace(
      /<a href="https:\/\/nyphon\.de\/en\/">EN<\/a>/g,
      `<a href="${escapeAttribute(urls.en)}" lang="en" hreflang="en">EN</a>`,
    );

  return output;
}

if (typeof hexo !== "undefined") {
  hexo.extend.filter.register("before_generate", function localizeNavigation() {
    const german = this.theme.i18n.get("de");
    this.theme.i18n.set("de", {
      ...german,
      "nav.about": "Über mich",
    });
  });

  hexo.extend.filter.register(
    "after_render:html",
    function addLocalizedMetadata(html, locals) {
      return enhanceLocalizedHtml(
        html,
        this.config.language,
        locals?.page?.permalink,
      );
    },
  );
}

module.exports = {
  buildLanguageUrls,
  enhanceLocalizedHtml,
};
