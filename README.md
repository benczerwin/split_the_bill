# Split the Bill

A small web app for splitting a restaurant bill fairly by item, including tax, tip, and an
optional cash-back discount — with a receipt-photo scanner to get you started fast.

## Features

- Add each item on the bill with its price, and assign it to everyone, one person, or any
  subset of people (great for appetizers shared by half the table).
- Enter tax as a dollar amount, and tip as either a dollar amount or a percentage.
- See each person's share of the meal, their total with tax & tip, and their total with a
  cash-back discount applied (e.g. paying with cash for a 4% card-fee savings).
- Track who's paid with a checkbox per person, and a running "collected so far" total.
- Scan a photo of a receipt to auto-populate items, tax, and tip using Claude's vision API
  (bring your own Anthropic API key — stored only in your browser).
- Everything auto-saves to your browser's local storage, so refreshing the page keeps your bill.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deploy

Pushing to `main` builds and publishes the app to GitHub Pages via
`.github/workflows/deploy.yml`. Enable Pages in the repo settings with source "GitHub Actions"
once this is merged.
