# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Sky Trip** is a static frontend flight booking web application. It has no build tools, no package manager, and no JavaScript framework — pure HTML, CSS, and vanilla JS.

## Running Locally

Since there's no build step, serve the files with any static HTTP server:

```bash
python -m http.server 8000
# Then visit: http://localhost:8000/html/home.html
```

Or open any `.html` file directly in a browser.

## Architecture

### File Organization

Each page follows a strict 1:1:1 mapping across three directories:

- `html/PageName.html` — structure
- `js/PageName.js` — behavior and API calls
- `css/PageName.css` — styling

Two shared files span all pages:
- `js/shared-header.js` / `css/shared-header.css` — navigation header injected into every page

### User Flow

```
home → available-flights → selected-flight → FlightDetails → SeatMap → Payment → payment-success
```

Admin and employee roles each have their own dashboard pages (`Admin.html`, `Employee.html`).

### API Integration

All JS files define `API_BASE_URL` at the top pointing to the Azure-hosted backend:

```
https://bookingtrip-api-2026-cyh0f4dhfednh3fj.westeurope-01.azurewebsites.net
```

Authentication uses JWT tokens stored in `localStorage` as `auth_token`, sent as `Bearer` tokens on every API request. If `auth_token` is missing or invalid, pages redirect to `Login.html`.

### State Management

There is no global state store. Pages pass data between each other via `localStorage` (e.g., selected flight, seat choices, booking details). Each page reads what it needs from `localStorage` on load.
