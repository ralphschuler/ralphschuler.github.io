# nyphon.de

Die zweisprachige persönliche Website unter [nyphon.de](https://nyphon.de) basiert auf Hexo und dem Cactus-Theme.

- Deutsch: [`/`](https://nyphon.de/)
- Englisch: [`/en/`](https://nyphon.de/en/)

## Lokale Entwicklung

```bash
yarn install --frozen-lockfile
yarn test
yarn clean
yarn build
yarn server
```

`yarn build` erzeugt beide Sprachversionen in einem gemeinsamen `public/`-Verzeichnis. Die deutschen Quellen liegen unter `source/`, die englischen unter `source-en/`.

## Automatische Projektübersicht

Der Workflow `Sync GitHub Pages projects` prüft stündlich die öffentlichen Repositories von `ralphschuler`. Aufgenommen werden Repositories, die:

- GitHub Pages aktiviert haben,
- nicht archiviert sind,
- keine Forks sind und
- nicht die Hauptseite `ralphschuler.github.io` selbst sind.

Die generierten Projektlisten liegen in `source/_data/projects.json` und `source-en/_data/projects.json`. Namen, lokalisierte Beschreibungen und Ziel-URLs lassen sich in `.github/pages-projects.config.json` überschreiben oder Projekte dort ausschließen.

Nach einem neuen erfolgreichen `github-pages`-Deployment erzeugt der Workflow genau ein zusammengehöriges Beitragspaar unter `source/_posts/project-updates/` und `source-en/_posts/project-updates/`. Anschließend committet er die generierten Dateien und veröffentlicht exakt diesen Stand. `.github/pages-project-state.json` verhindert doppelte Beiträge. Der initiale Stand wurde als Baseline gespeichert, daher werden keine alten Updates nachträglich veröffentlicht.
