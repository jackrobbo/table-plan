# Table Plan for Morrisons (beta browser extension)

Fills a Morrisons trolley from a Table Plan shopping list. It runs in the person's own browser and Morrisons session, signed in or not.

## What it does (and doesn't)

- On a Table Plan shopping list, **Fill my Morrisons trolley** opens the first product on Morrisons with the whole list in the address-bar fragment (`#tableplan=...`, never sent to a server).
- The extension, running only on `groceries.morrisons.com`, reads that fragment, removes it from the address bar, and **asks before doing anything**.
- On "Add them" it visits each product page and presses the page's own **Add** / **+** buttons, like a person would, then shows what went in and what didn't.
- It never calls Morrisons' APIs (their `robots.txt` disallows `/api/`), never reads or stores a login, never answers the cookie question for you, and stops at the trolley: the person chooses the delivery slot and checks out.
- Permissions: `storage` (the job, for the few seconds between page loads) and two content-script sites: `groceries.morrisons.com` and Table Plan (to leave a marker so the app knows the extension is installed).

## Install for testing (Chrome, Edge, Brave)

1. Unzip `table-plan-morrisons-extension.zip`, or use the `extension/` folder from this repo.
2. Open `chrome://extensions`, switch on **Developer mode**.
3. **Load unpacked** and pick the folder that contains `manifest.json`.
4. Open Table Plan, plan a week, open its shopping list: **Fill my Morrisons trolley** appears under the list.

Desktop only. Chrome on phones doesn't run extensions, so on a phone the per-item "Morrisons" links remain.

## Hand-off format

`#tableplan=` + base64url of UTF-8 JSON `{"v":1,"items":[{"s":"<product path>","q":<packs 1-36>,"n":"<name>"}]}` where `s` is the Morrisons product path (`morrisons-porridge-oats/105489771`). The extension ignores anything that doesn't match `^[a-z0-9][a-z0-9-]*/\d+$` and caps a list at 120 items. Encoder: `src/lib/basket.ts` (tested in `tests/basket.test.ts`); decoder: `readHandoff` in `morrisons.js`.

## Page hooks it relies on (check these first if Morrisons changes their site)

| Need | Selector |
|---|---|
| Main product's Add button | `button[data-test="counter-button"][data-synthetics="add-button"]` outside `[data-test="carousel-fop-wrapper"]` (carousels hold other products' buttons) |
| Quantity once in trolley | `input[data-test="quantity-in-basket"]` (min 0, max 36) |
| Increase quantity | `button[data-test="counter:increment"]` |
| "Check if we deliver to you" box (appears after the first add and blocks clicks) | `[role="dialog"]` with a `button[aria-label="Close modal"]` |
| Trolley total | `button[aria-label^="Trolley"]` ("Trolley £24.45 - ...") |

## Checked so far

Run against the live site as a guest in headless Chromium (extension loaded): 4 products (one quantity 3, one that doesn't exist) → 3 added, the missing one reported, trolley total £24.45 = the expected sum. A second run changed nothing (everything reported "already in your trolley"). About 3 s per product.

**Not yet checked: signed in.** Things to look at when testing signed in:

1. Items land in the real trolley and the total matches the plan's estimate (± price changes).
2. The delivery-location box (shown to guests after the first add) doesn't get in the way.
3. A product already in the trolley isn't added twice.
4. After a guest run, logging in merges the guest trolley into the account (Morrisons has a "basket merge" step; we haven't seen it happen).
5. Out-of-stock or unavailable-at-your-address items are reported, not skipped silently.
6. **Stop** halts mid-list; **Cancel** and **Done** clear the stored job.

## Later

Chrome Web Store listing (one-off $5 developer fee, review), Firefox/Safari builds, an affiliate-tagged entry link, and a per-store adapter if more supermarkets are added.
