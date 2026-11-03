# Classroom Compass

A shareable, browser-only app for class rosters, attendance, and teacher-customizable merit points. It is hosted as a static site on GitHub Pages and does not need Supabase, an account, or another backend.

## How storage works

The app saves data in the browser's local storage on the device and browser profile where it is used. Teachers on separate devices or browser profiles have separate data and can customize their own classes and point options independently.

There is no sign-in, cloud backup, or sync between devices. A teacher using another computer will not see their existing records. Clearing browser site data can erase them. Teachers sharing the same device and browser profile will share the app's data.

## Publish on GitHub Pages

1. Keep the app files in the repository root: index.html, styles.css, app.js, and .github/workflows/pages.yml.
2. In repository Settings → Pages, set the source to GitHub Actions.
3. Push changes to the main branch. The included workflow deploys the site.
4. Share the Pages URL with other teachers. Each teacher should use their own device and browser profile.

## Use

- Classes & attendance: create and rename classes, manage each roster, and take attendance by date.
- Point tracking: add or deduct points and keep a reason for each entry.
- Customize point options: create, edit, or delete categories for the selected class. Positive values award points; negative values deduct points. The amount can be changed for an individual entry.

## Files

- index.html, styles.css, app.js: browser app
- .github/workflows/pages.yml: GitHub Pages deployment
