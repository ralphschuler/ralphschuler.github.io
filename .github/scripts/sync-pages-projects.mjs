import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const API_ROOT = "https://api.github.com";
const API_VERSION = "2022-11-28";
const MAX_DEPLOYMENTS_TO_CHECK = 5;
const SHA_PATTERN = /^[0-9a-f]{40}$/i;
const LOCALES = ["de", "en"];
const SITE_TIME_ZONE = "Europe/Berlin";
const DEFAULT_DESCRIPTIONS = {
  de: "Open-Source-Projekt mit einer veröffentlichten GitHub-Pages-Demo.",
  en: "Open-source project with a published GitHub Pages demo.",
};

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../..");
const configPath = path.join(
  repositoryRoot,
  ".github/pages-projects.config.json",
);
const statePath = path.join(
  repositoryRoot,
  ".github/pages-project-state.json",
);
const sourceDirectories = {
  de: path.join(repositoryRoot, "source"),
  en: path.join(repositoryRoot, "source-en"),
};
const projectsDataPaths = Object.fromEntries(
  LOCALES.map((locale) => [
    locale,
    path.join(sourceDirectories[locale], "_data/projects.json"),
  ]),
);
const projectsPagePaths = Object.fromEntries(
  LOCALES.map((locale) => [
    locale,
    path.join(sourceDirectories[locale], "projects/index.md"),
  ]),
);
const postsDirectories = Object.fromEntries(
  LOCALES.map((locale) => [
    locale,
    path.join(sourceDirectories[locale], "_posts/project-updates"),
  ]),
);

export function isEligibleRepository(repository, config) {
  if (!repository || repository.private || !repository.has_pages) return false;
  if (!config.includeForks && repository.fork) return false;
  if (!config.includeArchived && repository.archived) return false;
  if (repository.name === config.siteRepository) return false;
  return !(config.excludedRepositories || []).includes(repository.name);
}

export function sanitizePlainText(value, maximumLength = 240) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximumLength);
}

export function sanitizeText(value, maximumLength = 240) {
  return sanitizePlainText(value, maximumLength)
    .replace(/\\/g, "\\\\")
    .replace(/([`*_{}\[\]()#+.!|>-])/g, "\\$1")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function displayName(repositoryName) {
  const trimmed = String(repositoryName || "").replace(/^\.+/, "");
  if (!/[._-]/.test(trimmed)) {
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  }

  return trimmed
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function slugify(value) {
  const slug = String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "project";
}

export function normalizeProjectUrl(value, fallbackUrl) {
  for (const candidate of [value, fallbackUrl]) {
    if (!candidate) continue;
    try {
      const url = new URL(candidate);
      if (url.protocol !== "https:" && url.protocol !== "http:") continue;
      url.protocol = "https:";
      url.username = "";
      url.password = "";
      url.hash = "";
      return url.toString();
    } catch {
      // Try the fallback URL.
    }
  }
  throw new Error("No safe project URL is available.");
}

export function markdownDestination(value) {
  const safeUrl = String(value)
    .replace(/\\/g, "%5C")
    .replace(/</g, "%3C")
    .replace(/>/g, "%3E");
  return `<${safeUrl}>`;
}

export function formatHexoDate(value, timeZone = SITE_TIME_ZONE) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid deployment date: ${value}`);
  }

  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .filter(({ type }) => type !== "literal")
      .map(({ type, value: partValue }) => [type, partValue]),
  );

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

export function shouldPublishUpdate(previous, deployment, bootstrap) {
  if (bootstrap || !isValidDeployment(deployment)) return false;
  return (
    !Number.isSafeInteger(Number(previous?.deploymentId)) ||
    Number(previous.deploymentId) !== Number(deployment.deploymentId)
  );
}

export function isValidDeployment(deployment) {
  return Boolean(
    SHA_PATTERN.test(deployment?.sha || "") &&
      Number.isSafeInteger(Number(deployment?.deploymentId)) &&
      Number(deployment.deploymentId) > 0 &&
      deployment?.deployedAt &&
      !Number.isNaN(Date.parse(deployment.deployedAt)),
  );
}

export function projectPostFilename(repository, deployment, locale) {
  return `${repository.id}-${deployment.deploymentId}-${locale}.md`;
}

export function buildProjectPost({
  repository,
  project,
  deployment,
  previous,
  locale = "de",
  commits = [],
  totalCommits = commits.length,
}) {
  const isNewProject = !previous?.sha;
  const isRedeployment = !isNewProject && previous.sha === deployment.sha;
  const translations = {
    de: {
      title: isNewProject
        ? `Neues Projekt: ${project.name}`
        : isRedeployment
          ? `Neu veröffentlicht: ${project.name}`
          : `Projekt-Update: ${project.name}`,
      category: "Projektupdates",
      intro: isNewProject
        ? "ist neu in meiner Projektübersicht."
        : isRedeployment
          ? "wurde mit demselben Quellstand erneut erfolgreich veröffentlicht."
          : "wurde aktualisiert.",
      changes: "Änderungen",
      moreCommits: (count) => `${count} weitere Commits`,
      published: "Veröffentlicht am",
      withCommit: "mit Commit",
      openProject: "Projekt öffnen",
      viewChanges: "Änderungen auf GitHub",
    },
    en: {
      title: isNewProject
        ? `New project: ${project.name}`
        : isRedeployment
          ? `Redeployed: ${project.name}`
          : `Project update: ${project.name}`,
      category: "Project updates",
      intro: isNewProject
        ? "is new to my project catalog."
        : isRedeployment
          ? "was successfully redeployed from the same source revision."
          : "has been updated.",
      changes: "Changes",
      moreCommits: (count) => `${count} more commits`,
      published: "Published on",
      withCommit: "from commit",
      openProject: "Open project",
      viewChanges: "View changes on GitHub",
    },
  };
  const copy = translations[locale] || translations.de;
  const title = copy.title;
  const safeTitle = sanitizePlainText(title, 140);
  const safeRepositoryName = sanitizePlainText(repository.name, 100);
  const shortSha = deployment.sha.slice(0, 12);
  const publishedAt = formatHexoDate(deployment.deployedAt);
  const commitUrl = `${project.repositoryUrl}/commit/${deployment.sha}`;
  const compareUrl = SHA_PATTERN.test(previous?.sha || "")
    ? `${project.repositoryUrl}/compare/${previous.sha}...${deployment.sha}`
    : commitUrl;
  const lines = [
    "---",
    `title: ${JSON.stringify(safeTitle)}`,
    `date: ${JSON.stringify(publishedAt)}`,
    `updated: ${JSON.stringify(publishedAt)}`,
    `permalink: ${JSON.stringify(`project-updates/${slugify(repository.name)}/${deployment.deploymentId}/`)}`,
    "categories:",
    `  - ${JSON.stringify(copy.category)}`,
    "tags:",
    "  - GitHub Pages",
    `  - ${JSON.stringify(safeRepositoryName)}`,
    "---",
    "",
    `[${sanitizeText(project.name)}](${markdownDestination(project.url)}) ${copy.intro}`,
    "",
  ];

  if (commits.length > 0) {
    lines.push(`## ${copy.changes}`, "");
    for (const commit of commits.slice(0, 8)) {
      const message = sanitizeText(commit.commit?.message?.split("\n")[0], 160);
      const fullSha = String(commit.sha || "");
      const sha = fullSha.slice(0, 7);
      if (message && SHA_PATTERN.test(fullSha)) {
        lines.push(
          `- ${message} ([\`${sha}\`](${markdownDestination(`${project.repositoryUrl}/commit/${fullSha}`)}))`,
        );
      }
    }
    if (totalCommits > 8) {
      lines.push(`- ${copy.moreCommits(totalCommits - 8)}`);
    }
    lines.push("");
  }

  lines.push(
    `${copy.published} ${publishedAt.slice(0, 10)} ${copy.withCommit} [\`${shortSha}\`](${markdownDestination(commitUrl)}).`,
    "",
    `[${copy.openProject}](${markdownDestination(project.url)}) · [${copy.viewChanges}](${markdownDestination(compareUrl)})`,
    "",
  );

  return lines.join("\n");
}

export function buildProjectsPage(projects, locale = "de") {
  const copy = locale === "en"
    ? {
        title: "Projects",
        intro:
          "These are my automatically discovered GitHub Pages projects. The catalog is refreshed after successful deployments.",
        empty: "There are currently no published projects available.",
        lastPublished: "Last successful deployment",
        pagesEnabled: "GitHub Pages is enabled for this project.",
        openProject: "View project",
        source: "Source code",
      }
    : {
        title: "Projekte",
        intro:
          "Hier findest du meine automatisch erkannten GitHub-Pages-Projekte. Die Liste wird nach erfolgreichen Veröffentlichungen aktualisiert.",
        empty: "Aktuell sind keine veröffentlichten Projekte verfügbar.",
        lastPublished: "Letzte erfolgreiche Veröffentlichung",
        pagesEnabled: "GitHub Pages ist für dieses Projekt aktiviert.",
        openProject: "Projekt ansehen",
        source: "Quellcode",
      };
  const lines = [
    "---",
    `title: ${copy.title}`,
    "layout: page",
    "permalink: projects/index.html",
    "---",
    "",
    `# ${copy.title}`,
    "",
    copy.intro,
    "",
  ];

  if (projects.length === 0) {
    lines.push(copy.empty, "");
    return lines.join("\n");
  }

  for (const project of projects) {
    lines.push(
      `## [${sanitizeText(project.name)}](${markdownDestination(project.url)})`,
      "",
      project.desc,
      "",
      project.deployedAt
        ? `${copy.lastPublished}: ${formatHexoDate(project.deployedAt).slice(0, 10)}`
        : copy.pagesEnabled,
      "",
      `[${copy.openProject}](${markdownDestination(project.url)}) · [${copy.source}](${markdownDestination(project.repositoryUrl)})`,
      "",
    );
  }

  return lines.join("\n");
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw new Error(`Could not read ${filePath}: ${error.message}`);
  }
}

async function writeIfChanged(filePath, content) {
  let current = null;
  try {
    current = await readFile(filePath, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (current === content) return false;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
  return true;
}

function apiHeaders(useAuthentication = true) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "nyphon-pages-project-sync",
    "X-GitHub-Api-Version": API_VERSION,
  };
  if (useAuthentication && process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

async function githubRequest(apiPath, { allowAnonymousFallback = false } = {}) {
  const request = async (useAuthentication) => {
    const response = await fetch(`${API_ROOT}${apiPath}`, {
      headers: apiHeaders(useAuthentication),
    });
    return response;
  };

  let response = await request(true);
  if (
    allowAnonymousFallback &&
    process.env.GITHUB_TOKEN &&
    [403, 404].includes(response.status)
  ) {
    response = await request(false);
  }

  if (!response.ok) {
    const remaining = response.headers.get("x-ratelimit-remaining");
    const reset = response.headers.get("x-ratelimit-reset");
    const detail = await response.text();
    throw new Error(
      `GitHub API ${response.status} for ${apiPath}` +
        (remaining === "0" ? ` (rate limit resets at ${reset})` : "") +
        `: ${detail.slice(0, 300)}`,
    );
  }

  return response.json();
}

async function listRepositories(owner) {
  const repositories = [];
  for (let page = 1; page <= 10; page += 1) {
    const batch = await githubRequest(
      `/users/${encodeURIComponent(owner)}/repos?per_page=100&type=owner&sort=full_name&page=${page}`,
      { allowAnonymousFallback: true },
    );
    if (!Array.isArray(batch)) {
      throw new Error("GitHub returned an invalid repository list.");
    }
    repositories.push(...batch);
    if (batch.length < 100) break;
  }
  return repositories;
}

async function latestSuccessfulDeployment(owner, repository, previous) {
  const repoPath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository.name)}`;
  const deployments = await githubRequest(
    `${repoPath}/deployments?environment=github-pages&per_page=${MAX_DEPLOYMENTS_TO_CHECK}`,
    { allowAnonymousFallback: true },
  );
  if (!Array.isArray(deployments)) {
    throw new Error(`GitHub returned invalid deployments for ${repository.name}.`);
  }

  for (const deployment of deployments) {
    if (
      previous?.deploymentId &&
      Number(deployment.id) === Number(previous.deploymentId) &&
      isValidDeployment(previous)
    ) {
      return previous;
    }
    const statuses = await githubRequest(
      `${repoPath}/deployments/${deployment.id}/statuses?per_page=1`,
      { allowAnonymousFallback: true },
    );
    const status = Array.isArray(statuses) ? statuses[0] : null;
    if (status?.state !== "success") continue;
    const candidate = {
      deploymentId: Number(deployment.id),
      sha: deployment.sha,
      deployedAt:
        status.updated_at || deployment.updated_at || deployment.created_at,
      environmentUrl: status.environment_url || "",
    };
    if (isValidDeployment(candidate)) return candidate;
  }

  return isValidDeployment(previous) ? previous : null;
}

async function compareCommits(owner, repositoryName, base, head) {
  if (
    !SHA_PATTERN.test(base || "") ||
    !SHA_PATTERN.test(head || "") ||
    base === head
  ) {
    return { commits: [], totalCommits: 0 };
  }
  try {
    const comparison = await githubRequest(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repositoryName)}/compare/${base}...${head}`,
      { allowAnonymousFallback: true },
    );
    return {
      commits: Array.isArray(comparison.commits) ? comparison.commits : [],
      totalCommits: Number(comparison.total_commits || comparison.commits?.length || 0),
    };
  } catch (error) {
    console.warn(`Could not load commit comparison for ${repositoryName}: ${error.message}`);
    return { commits: [], totalCommits: 0 };
  }
}

function projectFromRepository(repository, deployment, config, locale) {
  const override = config.overrides?.[repository.name] || {};
  const fallbackUrl = `${config.siteUrl.replace(/\/$/, "")}/${encodeURIComponent(repository.name)}/`;
  const rawUrl =
    override.url || deployment?.environmentUrl || repository.homepage || fallbackUrl;
  const localizedOverride = override.descriptions?.[locale];
  const rawDescription = locale === "en"
    ? localizedOverride || override.description || repository.description || DEFAULT_DESCRIPTIONS.en
    : localizedOverride || override.description || DEFAULT_DESCRIPTIONS.de;

  return {
    id: repository.id,
    name: sanitizePlainText(override.name || displayName(repository.name), 100),
    url: normalizeProjectUrl(rawUrl, fallbackUrl),
    desc: sanitizeText(rawDescription, 280),
    repository: repository.full_name,
    repositoryUrl: normalizeProjectUrl(
      repository.html_url,
      `https://github.com/${config.owner}/${encodeURIComponent(repository.name)}`,
    ),
    deployedAt: deployment?.deployedAt || null,
    deploymentSha: deployment?.sha || null,
  };
}

async function main() {
  const bootstrap = process.argv.includes("--bootstrap");
  const config = await readJson(configPath, null);
  if (!config?.owner || !config?.siteRepository || !config?.siteUrl) {
    throw new Error("The project sync configuration is incomplete.");
  }

  const previousState = await readJson(statePath, { version: 1, projects: {} });
  const repositories = (await listRepositories(config.owner))
    .filter((repository) => isEligibleRepository(repository, config))
    .sort((a, b) => a.id - b.id);

  const results = [];
  for (const repository of repositories) {
    const previous = previousState.projects?.[String(repository.id)] || null;
    const deployment = await latestSuccessfulDeployment(
      config.owner,
      repository,
      previous,
    );
    if (!isValidDeployment(deployment)) {
      console.warn(
        `Skipping ${repository.name}: no successful GitHub Pages deployment was found.`,
      );
      continue;
    }
    const projects = Object.fromEntries(
      LOCALES.map((locale) => [
        locale,
        projectFromRepository(repository, deployment, config, locale),
      ]),
    );
    results.push({ repository, previous, deployment, projects });
  }

  const localizedProjects = Object.fromEntries(
    LOCALES.map((locale) => [
      locale,
      results
        .map(({ projects }) => projects[locale])
        .sort((a, b) => {
          const dateOrder = String(b.deployedAt || "").localeCompare(
            String(a.deployedAt || ""),
          );
          return dateOrder || a.name.localeCompare(b.name, locale);
        }),
    ]),
  );

  const nextState = {
    version: 1,
    projects: { ...(previousState.projects || {}) },
  };
  let generatedPosts = 0;

  for (const { repository, previous, deployment, projects } of results) {
    if (deployment?.sha) {
      nextState.projects[String(repository.id)] = {
        repository: repository.name,
        deploymentId: deployment.deploymentId,
        sha: deployment.sha,
        deployedAt: deployment.deployedAt,
        environmentUrl: deployment.environmentUrl || projects.de.url,
      };
    }

    if (!shouldPublishUpdate(previous, deployment, bootstrap)) continue;
    const comparison = await compareCommits(
      config.owner,
      repository.name,
      previous?.sha,
      deployment.sha,
    );
    for (const locale of LOCALES) {
      const postPath = path.join(
        postsDirectories[locale],
        projectPostFilename(repository, deployment, locale),
      );
      const changed = await writeIfChanged(
        postPath,
        buildProjectPost({
          repository,
          project: projects[locale],
          deployment,
          previous,
          locale,
          ...comparison,
        }),
      );
      if (changed) generatedPosts += 1;
    }
  }

  for (const locale of LOCALES) {
    await writeIfChanged(
      projectsDataPaths[locale],
      `${JSON.stringify(localizedProjects[locale], null, 2)}\n`,
    );
    await writeIfChanged(
      projectsPagePaths[locale],
      buildProjectsPage(localizedProjects[locale], locale),
    );
  }
  await writeIfChanged(statePath, `${JSON.stringify(nextState, null, 2)}\n`);

  console.log(
    `Synchronized ${localizedProjects.de.length} Pages projects in ${LOCALES.length} languages; generated ${generatedPosts} blog post(s).`,
  );
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
