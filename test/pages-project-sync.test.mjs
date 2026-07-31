import assert from "node:assert/strict";
import test from "node:test";

import {
  buildProjectPost,
  buildProjectsPage,
  displayName,
  formatHexoDate,
  isEligibleRepository,
  isValidDeployment,
  markdownDestination,
  normalizeProjectUrl,
  projectPostFilename,
  sanitizeText,
  shouldPublishUpdate,
  slugify,
} from "../.github/scripts/sync-pages-projects.mjs";

const config = {
  siteRepository: "ralphschuler.github.io",
  includeForks: false,
  includeArchived: false,
  excludedRepositories: ["hidden-project"],
};

test("only active public Pages repositories are eligible", () => {
  const repository = {
    name: "demo",
    private: false,
    has_pages: true,
    fork: false,
    archived: false,
  };
  assert.equal(isEligibleRepository(repository, config), true);
  assert.equal(isEligibleRepository({ ...repository, has_pages: false }, config), false);
  assert.equal(isEligibleRepository({ ...repository, fork: true }, config), false);
  assert.equal(isEligibleRepository({ ...repository, archived: true }, config), false);
  assert.equal(
    isEligibleRepository({ ...repository, name: "ralphschuler.github.io" }, config),
    false,
  );
  assert.equal(
    isEligibleRepository({ ...repository, name: "hidden-project" }, config),
    false,
  );
});

test("project names and slugs are deterministic", () => {
  assert.equal(displayName("whatsapp-replay-studio"), "Whatsapp Replay Studio");
  assert.equal(displayName("TopoLens"), "TopoLens");
  assert.equal(slugify("Civilisation.dapp"), "civilisation-dapp");
});

test("project URLs are restricted to HTTP and normalized to HTTPS", () => {
  assert.equal(
    normalizeProjectUrl("http://nyphon.de/demo/#section", "https://example.com"),
    "https://nyphon.de/demo/",
  );
  assert.equal(
    normalizeProjectUrl("javascript:alert(1)", "https://nyphon.de/demo/"),
    "https://nyphon.de/demo/",
  );
  assert.equal(
    markdownDestination("https://example.com/x)[unsafe](javascript:alert(1))"),
    "<https://example.com/x)[unsafe](javascript:alert(1))>",
  );
});

test("untrusted text cannot inject HTML or Markdown", () => {
  const sanitized = sanitizeText("<script>alert(1)</script> [click](bad) *bold*");
  assert.doesNotMatch(sanitized, /<script>/);
  assert.match(sanitized, /\\\[click\\\]/);
  assert.match(sanitized, /\\\*bold\\\*/);
});

test("deployment timestamps are formatted for Hexo in the site timezone", () => {
  assert.equal(
    formatHexoDate("2026-07-31T10:00:00Z"),
    "2026-07-31 12:00:00",
  );
  assert.equal(
    formatHexoDate("2026-01-31T10:00:00Z"),
    "2026-01-31 11:00:00",
  );
});

test("bootstrap and unchanged deployments do not publish posts", () => {
  const oldDeployment = {
    deploymentId: 1,
    sha: "a".repeat(40),
    deployedAt: "2026-07-30T10:00:00Z",
  };
  const newDeployment = {
    deploymentId: 2,
    sha: "b".repeat(40),
    deployedAt: "2026-07-31T10:00:00Z",
  };
  assert.equal(isValidDeployment(newDeployment), true);
  assert.equal(isValidDeployment({ ...newDeployment, sha: "unsafe" }), false);
  assert.equal(shouldPublishUpdate(null, newDeployment, true), false);
  assert.equal(shouldPublishUpdate(oldDeployment, oldDeployment, false), false);
  assert.equal(shouldPublishUpdate(oldDeployment, newDeployment, false), true);
  assert.equal(
    shouldPublishUpdate(
      oldDeployment,
      { ...newDeployment, sha: oldDeployment.sha },
      false,
    ),
    true,
  );
  assert.equal(shouldPublishUpdate(null, newDeployment, false), true);
});

test("generated posts use stable paths and escaped commit messages", () => {
  const repository = { id: 42, name: "demo-project" };
  const deployment = {
    deploymentId: 222,
    sha: "b".repeat(40),
    deployedAt: "2026-07-31T10:00:00Z",
  };
  const project = {
    name: "Demo Project",
    url: "https://nyphon.de/demo-project/",
    repositoryUrl: "https://github.com/ralphschuler/demo-project",
  };
  const post = buildProjectPost({
    repository,
    deployment,
    project,
    previous: { sha: "a".repeat(40) },
    commits: [
      {
        sha: "c".repeat(40),
        commit: { message: "Fix <script> [unsafe](url)\nDetails" },
      },
    ],
    totalCommits: 1,
  });
  assert.equal(projectPostFilename(repository, deployment, "de"), "42-222-de.md");
  assert.match(post, /Projekt-Update: Demo Project/);
  assert.match(post, /date: "2026-07-31 12:00:00"/);
  assert.doesNotMatch(post, /<script>/);
  assert.match(post, /\\\[unsafe\\\]/);
  assert.match(post, /project-updates\/demo-project\/222\//);
  assert.match(post, /\]\(<https:\/\/nyphon\.de\/demo-project\/>\)/);
});

test("the projects page contains project and source links", () => {
  const page = buildProjectsPage([
    {
      name: "Demo",
      url: "https://nyphon.de/demo/",
      desc: "Beschreibung",
      deployedAt: "2026-07-31T10:00:00Z",
      repositoryUrl: "https://github.com/ralphschuler/demo",
    },
  ]);
  assert.match(page, /title: Projekte/);
  assert.match(page, /\[Demo\]\(<https:\/\/nyphon\.de\/demo\/>\)/);
  assert.match(page, /\[Quellcode\]\(<https:\/\/github\.com\/ralphschuler\/demo>\)/);
});

test("English project pages and posts use localized copy", () => {
  const project = {
    name: "Demo",
    url: "https://nyphon.de/demo/",
    desc: "Description",
    deployedAt: "2026-07-31T10:00:00Z",
    repositoryUrl: "https://github.com/ralphschuler/demo",
  };
  const page = buildProjectsPage([project], "en");
  const post = buildProjectPost({
    repository: { id: 42, name: "demo" },
    deployment: {
      deploymentId: 222,
      sha: "b".repeat(40),
      deployedAt: "2026-07-31T10:00:00Z",
    },
    project,
    previous: null,
    locale: "en",
  });
  assert.match(page, /# Projects/);
  assert.match(page, /Last successful deployment/);
  assert.match(post, /New project: Demo/);
  assert.match(post, /Open project/);
});
