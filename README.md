# Shopping Agent — Barcode Scanner Prototype

> A browser-based barcode scanner with product lookup and a temporary shopping/fridge list.

**Category:** frontend prototype · browser APIs · third-party data integration  
**Stack:** HTML · CSS · vanilla JavaScript · ZXing · Open Food Facts API

## Overview

This prototype captures a barcode from a camera preview or manual entry, checks its validity, and attempts to retrieve matching product details. The UI adds the result to a visible list, with status messages to show what happened.

**This is not yet an AI-powered shopping agent.** The current implementation performs barcode recognition, validation, HTTP lookup and simple list rendering. It does not use an LLM, recommendations, persistent accounts, or a backend service.

## Features

- Camera capture with a cropped scan area for barcode detection.
- Manual barcode entry for devices without a camera.
- EAN-13, EAN-8 and UPC-A check-digit validation.
- Product name, brand and image lookup via the public Open Food Facts API.
- Session-only list of recognized products and status logs.

## Run locally

There is no build step and no package manager required for the current source.

1. Clone this repository and open its folder in VS Code.
2. Start a local HTTP server (for example, the VS Code Live Server extension).
3. Open `index.html` from `http://localhost` (or another secure HTTPS origin).
4. Use **Start Barcode Scan**, allow camera access, and position the barcode in the highlighted region. Alternatively, enter a barcode manually.

Browsers generally require a secure context for camera access. Product lookup requires network access, and the UI currently loads ZXing from a CDN.

## Implementation

| File | Purpose |
| --- | --- |
| `index.html` | Scanner, camera preview, manual entry and list containers |
| `app.js` | Barcode checksum validation, scanning, API integration and UI updates |
| `styles.css` | Responsive presentation |
| `README.md` | Project documentation |

The barcode lookup endpoint is `https://world.openfoodfacts.org/api/v2/product/{barcode}.json`. This public dataset may not contain every product, and the service is not an endorsement of the project.

## Known limitations

- The list is temporary and is not persisted or synchronized across devices.
- Camera availability, frame recognition and product lookup depend on the browser, device and external service.
- There is no automated test suite or production monitoring yet.
- The barcode scanning library is loaded using a floating CDN version; dependency pinning is a priority for reproducibility.
- Before production, implement robust offline/error handling, accessibility checks, and safe handling of external content and image URLs.

## Suggested product roadmap

1. Add unit tests for barcode validators.
2. Persist the list locally and support add/remove/quantity changes.
3. Improve mobile UX and accessibility.
4. Introduce a server component if future inventory, household-sharing or AI features actually require it.

**Status:** Working-code prototype, not a production service. Browser behavior has not been independently verified in this documentation pass.
