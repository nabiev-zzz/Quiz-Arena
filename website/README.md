# QUIZ ARENA official landing page

A lightweight, responsive static product website in Uzbek, Russian and English.

## Hosting on Railway

This folder includes a minimal Nginx Dockerfile and configuration.

- Connect the GitHub repository `nabiev-zzz/Quiz-Arena`.
- Set the service root directory to `/website`.
- Railway detects `Dockerfile` and builds the static site.
- The container listens on port `8080`.
- No build command, backend, secrets or environment variables are required.

## Preview locally

Open `index.html` in a browser, or run a simple static server from the repository root:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080/website/`.

## Content

- Responsive landing page and app preview
- Uzbek, Russian and English language switcher
- Feature overview, how-it-works section and subscription prices
- Download section with clearly marked coming-soon buttons

Android and iOS buttons intentionally remain disabled until official distribution URLs are available. Do not replace them with guessed APK or store links.
