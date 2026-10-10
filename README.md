# VOLT website

The company site for VOLT: the EV charging network that pays drivers in crypto. Drivers earn Lightnings on every kWh they charge at a Volt Adda.

Live at https://volt-website-wheat.vercel.app

The site is static, with no build step:

- `index.html` holds the page, its styles and the small scripts (tabs, charger screen, Lightnings calculator, stat count-up).
- `hero3d.js` is the interactive Three.js hero: a car at a VOLT charger. Visitors connect the plug, watch a live session, and see Lightnings fly into the coin. Three.js loads from jsDelivr through the import map at the bottom of `index.html`. Without WebGL, or with reduced motion turned on, the page skips the 3D scene.
- `models/car.glb` is the car, compressed with gltf-transform (meshopt, WebP textures). Its maker badges and watermarked dashboard screens are removed in code. If the file is missing, a built-in SUV is drawn instead.

## Preview parameters

- `?t=<seconds>` starts a session and fast-forwards it, for example `?t=6`.
- `?paint=orange|graphite|pearl|jade|orig` sets the car colour.
- `?tab=why|how|lightnings|network|about` opens a tab.
- `?cam=front|rear|grille` gives close-up views for checking the model.

## Running locally

ES modules don't load from `file://`, so serve the folder: `npx http-server -p 5173 -c-1 .` and open http://localhost:5173.

## Credits

Car model: "Tata Tiago" by BHP3D (https://sketchfab.com/3d-models/tata-tiago-7ae10b287a184453b19a83ed5b37c007), licensed CC BY 4.0. Colours and badges modified by VOLT. The footer of the site carries the same credit.

## Deploying

The repo is connected to Vercel. Every push to `main` deploys to production, and pushes to other branches get their own preview URL.
