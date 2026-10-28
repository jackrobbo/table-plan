# Inspiration: Cherrypick (competitor) walkthrough

Source: Jack's Android screen recording, 25 Oct 2026 (2m48s, Sainsbury's account). Notes on UX and feel to borrow from, not copy. Their look is flat, bold and illustrated (dark-green display type, magenta buttons, lime / pink / pale-blue accents, hand-drawn mascot); ours is the glass look, so borrow the structure and the tone, not the style.

## What they do well
- **One question per screen, thin progress bar plus back arrow.** Household stepper (adults / children / infants, round − and +), then 2-column tile grids with a picture for dietary needs and food goals ("More veg", "Fewer carbs", "More protein"). Choosing is quick and visual.
- **Personality in the copy.** "Do these meals make your tastebuds tingle?", "Plan it / Shop it / Cook it", "Finalising... your handpicked meal selection".
- **Value before the account.** "Your meal matches are ready!" appears first, then "create an account to save your answers" with a Skip.
- **Permission asked in context** (notifications, mid-onboarding), not on first launch.
- **A "generating" moment.** Animated Monday / Tuesday cards while the plan builds (our UX-audit gap 15).
- **A 3-step explainer** ("Meal-plan and shop in under 2 mins"): generate, auto-shop, checkout.
- **Four tabs: Plan, Shop, Cook, You.** "You" is the person's initial in a circle. Each screen has a big friendly heading and a one-line sub.
- **Meal rows lead with the photo**, then rating and time, then a one-line personal reason ("boosts your protein intake...") and an inline servings stepper and thumbs-down. Greeting: "Hi, Jack" plus why this week's picks.
- **Shop tab.** Store line ("You're set to Sainsbury's"), Online / In-store toggle, meal cards in a horizontal strip with a delete button, a "Basket Health" card (plants 10/30, ultra-processed 23%).
- **Sticky checkout button above the tab bar**: "Checkout with Sainsbury's £38.01". Count badge on the Shop tab, and a toast above the bar ("Meals added to shop!").
- **"What you'll need" list.** Product photo, name, price and price per kg, an "In 1 recipe" chip, Swap, a tick, and a clear "Currently unavailable" state.
- **Connect-account screen** that says plainly what is shared and why.

## Ideas for Table Plan
1. Greeting with a reason on the plan: "Hi Jack, this week is built for 1,950 kcal and 160g protein" (UX gap: name greeting).
2. A one-line "why this meal" on each meal row, using the macros we already have.
3. A real "Building your week" screen after onboarding (guardrail steps, light animation).
4. Tile grids for goal / allergies / dislikes with Lucide icons (allergies are chips today).
5. A Shop tab, or a sticky "Fill my Morrisons trolley · ≈ £xx" bar above the tab bar, with a count badge for items still to add. Our trolley result card could use their "what you'll need" row layout: photo, price, "in N recipes", swap, unavailable.
6. A "Plan health" card in place of their basket health: days on target, protein average.
7. Ask for notification permission inside onboarding with the reason; consider showing the plan before asking for the email.
8. A friendlier voice in headings and empty states, still plain and UK.

## Not for us
Their mascot and sticker style, Nectar and loyalty links, in-store mode, "AI shopping list". We have no partner connection to the supermarket, which is why trolley filling is the checkout step.
