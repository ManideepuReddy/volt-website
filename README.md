# VOLT website

The company site for VOLT: app-free EV fast charging from Hyderabad, volters, and the 50,000-volter franchise model.

Live at https://volt-website-wheat.vercel.app

The whole site is `index.html`: one static page with no build step. Fonts come from Google Fonts; everything else is inline.

## Deploying

The repo is connected to Vercel. Every push to `main` deploys to production, and pushes to other branches get their own preview URL.

To deploy from your machine without pushing, run `npx vercel deploy --prod` in this folder.
