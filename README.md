# Amy — Portfolio Site

Static one-page portfolio for a graphic designer / video editor / filmmaker. Plain HTML/CSS/JS, no build step.

## Structure

- `index.html` — page content
- `assets/style.css` — styles
- `assets/main.js` — filters, lightbox, mobile nav, contact form

## Editing content

- Swap placeholder projects in the `projects` array in `assets/main.js`.
- Replace `hello@example.com` and social links in `index.html`.
- Portrait and work thumbnails are text placeholders — replace with real images/video embeds when ready.

## Local preview

Serve the folder with any static server, e.g.:

```
npx serve .
```

## Deployment

Pushes to `main` deploy automatically to GitHub Pages via `.github/workflows/deploy.yml`.
