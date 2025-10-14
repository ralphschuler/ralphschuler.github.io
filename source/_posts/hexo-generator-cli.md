uuid: e3c22260-8cb7-11f0-92a9-896e8fd6b353
title: Hexo CLI Browser – from concept to early beta
nanoid: J3IQZwqj9szHYIYTh7mJC
date: 2025-09-08 15:29:47
tags:
featured_image:
thumbnail:
---

Hexo CLI Browser – from concept to early beta

It all started with a simple observation: as developers, we spend most of our day in a terminal—so why not bring our Hexo blogs along for the ride? That thought gave rise to the Hexo CLI Browser, an interactive terminal interface that lets you read posts and pages straight from the command line.

From sketch to screen

The journey from idea to early beta has been surprisingly fun. Our first task was getting Markdown to look good in a shell. Headings needed to stand out, inline code deserved some colour, and blockquotes warranted their own stylistic touch. After some experimentation, we settled on a renderer that transforms your Markdown into clean, ANSI‑coloured plain text. Level‑1 headings appear as bold separators, inline code pops in yellow, blockquotes are prefixed with a neat vertical bar, and links are shown in blue with the URL in parentheses.

Navigation came next. We wanted more than a static list; the CLI Browser had to scale gracefully with a growing archive. The solution is a simple paging system: use n and p to move forward and back through menu pages, select posts by number, return to the previous view with b, or jump home with 0. A small history file under /tmp preserves your path so that forward/back browsing feels as natural as in a graphical browser.

Built with languages in mind

A highlight of the project is its automatic language detection. Without any configuration, the browser reads your system locale variables (LANG, LC_ALL, etc.) and adapts its interface accordingly. English, German, French, Spanish, Italian and Japanese are already supported. Should your locale not be recognised, the plugin defaults to English. If you prefer to override detection, an option in _config.yml will later allow you to set a specific language once the plugin is published.

Features taking shape

Interactive navigation via a colourised menu, with history and paging.

Readable Markdown rendering: clear headings, coloured code, tidy blockquotes and links.

Favorites management: mark any page as a favourite for quick recall (stored in your home directory).

Simple search: enter a keyword and jump straight to matching posts.

Customisable page size for large archives, so you can control how many entries appear per screen.

Even though the project isn’t public yet, the core features already offer a comfortable command‑line reading experience. It’s designed to be flexible: you can disable favourites entirely, adjust the menu size, or extend the translation table for additional languages.

What’s next

There isn’t a GitHub repository just yet, but the roadmap is clear. Packaging the plugin for npm, adding more languages, enhancing the search with fuzzy matching, and exploring lightweight caching for faster loading are all on the horizon. We’re also keen to hear feedback on which features developers find most useful and where improvements are needed.

For now, the Hexo CLI Browser remains a work in progress—one we’re excited to share more widely in the near future. Stay tuned for updates as we polish the project and prepare it for its official debut.
