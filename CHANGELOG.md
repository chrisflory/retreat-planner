# Changelog

## 2.1.0+beta.3

- **Saved plans:** name and save every entry (assumptions, setup and living costs, estimates), then load, export or delete it from "Saved plans" at the top of Assumptions. Loading keeps what you had as "Before loading …" so you can switch back. Export writes a .json file with the system save dialog; Import adds a plan file to the list.
- **Fixed:** the 401(k) at retirement was in future dollars while the costs, land and Social Security are in today's dollars, which overstated the money for anyone retiring years from now. The plan now uses the balance in today's dollars and shows both figures. The chart's line before retirement is in today's dollars too.
- **Fixed:** the summary's Social Security figure now includes the Social Security cut switch and a spouse's check, matching the math.
- Removed two test screenshots that were committed by mistake in beta.2.

## 2.1.0+beta.2

- **Fixed:** when the money ran out, the plan carried the shortfall as a debt that later Social Security paid back, so the line could dip below $0 and come back as if you'd borrowed. Balances now stop at $0. Bills in those years are counted as unpaid, and if income later beats the budgeted bills, the leftover builds up from $0.
- When that happens, the verdict and the shortfall note say when the balance comes back and how much went unpaid in between.
- The money chart is now in today's dollars, like the rest of the plan, so a small yearly leftover no longer looks like a fortune by 95.

## 2.1.0+beta.1

### Money math
- The money engine now lives in `src/engine.ts`, separate from the screens, with a test suite (`npm test`). Tests run on every push and before each release build.
- **Fixed:** full retirement age for people born 1955–1959 was 66 flat. It now steps up 2 months per birth year (66 and 2 months through 66 and 10 months), which changes the early and delayed claiming math for them.
- **Fixed:** the thresholds that decide how much Social Security is taxed ($25K/$34K single, $32K/$44K joint) were being raised with inflation. The law fixes them, so later-year taxes were too low.
- **Fixed:** interest on cash was never taxed. It's now taxed, and counted as ACA income, the year after it's earned.
- **Added:** the $6,000 deduction for people 65 and older (tax years 2025–2028), with its phase-out above $75K/$150K.
- **Health insurance before 65 is priced from each year's income** using the 2026 ACA subsidy table (Rev. Proc. 2025-25). ACA income now includes all of Social Security. In expansion states, income under 138% of the poverty line uses Medicaid (switchable, with a note about estate recovery after 55). In Tennessee, Mississippi and Wyoming, income under the poverty line gets full price (the coverage gap). The old flat health line is still available with "Price ACA insurance from income" turned off.
- **Added a spouse's Social Security** as its own check with its own start age.
- **Added market risk:** a "yearly swing" input, a rough-market-start scenario, and the chance the money lasts to your goal across 300 replays with random returns. Cash plans (all at once, split) aren't affected by the market, and the app says so.
- 401(k) limit notes updated to 2026: $24,500, $32,500 at 50+, $35,750 at 60–63.

### Look and flow
- A verdict at the top: the age the money lasts to, your goal, market odds, rough-start and high-inflation results.
- Section links under the title, and the top bar and links stay put while you scroll.
- Assumptions are grouped into seven sections that open and close and remember their state. Closed sections show a one-line summary.
- The chart and scenario numbers stay in view beside the assumptions while you scroll through them.
- Chart lines stop at $0 the year the money runs out instead of diving off the bottom.
- A year-by-year strip shows health coverage and cost from retirement to 65.
- The long method notes are folded into "How the math works" and "Reading the chart".
