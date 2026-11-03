# Classroom Merit

A shareable classroom app for class rosters, attendance, and teacher-customizable merit points. GitHub Pages hosts the app; Supabase provides sign-in and the database.

## Privacy model

Each teacher signs in with their own account. Database row-level security checks that account against the owner of each class. Teachers can read or edit only their own classes and the related rosters, point options, attendance, and point history. Point options are saved per class, so customizing a class does not change another teacher's setup.

The browser uses the Supabase anon/public key. Never put a Supabase service_role key in this repository. The schema enables row-level security for every app table.

## One-time setup

1. Create a Supabase project at supabase.com.
2. Open the Supabase SQL Editor, paste in supabase/schema.sql, and run it.
3. In Supabase Project Settings → API, copy the Project URL and anon/public key.
4. Edit config.js. Replace YOUR_SUPABASE_PROJECT_URL and YOUR_SUPABASE_ANON_KEY with those values.
5. In Supabase Authentication → URL Configuration, set the Site URL and add your GitHub Pages URL to the allowed redirect URLs. It will look like https://YOUR-GITHUB-NAME.github.io/YOUR-REPOSITORY/.
6. Create a GitHub repository and upload the contents of this folder to its root.
7. In GitHub, open Settings → Pages and choose GitHub Actions as the publishing source.
8. Push the files to the main branch. The included workflow publishes the app. Open the URL shown under repository Settings → Pages.
9. Create a teacher account. If email confirmation is enabled in Supabase, confirm the email before signing in.

To limit who may use the app, disable public sign-ups in Supabase after the intended teacher accounts have been created. If sign-ups are open, others can create their own isolated accounts; they still cannot see another teacher's data.

## Use

- Classes & attendance: create and rename classes, manage each roster, and take attendance by date.
- Point tracking: select a class, add or deduct points, and keep a reason for each entry.
- Customize point options: add, edit, or delete categories for the selected class. Positive values award points; negative values deduct points. The amount can be changed for an individual entry.

## Local preview

After configuring Supabase, serve this folder from a local static web server. Opening the HTML directly as a file URL is not supported by all browsers because browser modules and authentication redirects expect an HTTP origin.

## Project files

- index.html, styles.css, app.js: browser app
- config.js: Supabase URL and public anon key
- supabase/schema.sql: database tables, indexes, grants, and row-level security
- .github/workflows/pages.yml: GitHub Pages deployment
