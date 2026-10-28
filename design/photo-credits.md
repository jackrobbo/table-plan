# Stand-in photos and credits

Until meals have their own photos, every meal shows a stand-in food photo (`img.ph` in the compiled recipe; `src/lib/content/placeholder.ts` picks one by name) and the welcome page carousel uses four more. All are from Unsplash under the Unsplash License (free for commercial use, no attribution required, no model release implied; none show a face). Credits are kept here and in `content/images/placeholders.json` anyway.

- The stand-ins are **illustrative**, not the actual dish. Alt text says "Illustrative photo: ...".
- To replace one: add the meal's own photo (`content/images/originals/<slug>.jpg` + `image.alt` in the recipe, then `npm run images:build`). It takes over automatically; nothing else to change.
- To rebuild the stand-ins: `npm run images:placeholders -- <folder with <key>.jpg originals>`.
- When every meal has its own photo, delete the `ph-*` files in `public/meals`, `content/images/placeholders.json`, and the stand-in lines in `scripts/import-content.ts`.

Re-check the Unsplash terms before launch: https://unsplash.com/license

| Key | Photographer | Source |
|---|---|---|
| food-eggs | amirali mirhashemian | https://unsplash.com/photos/egg-omelet-4gmBIFraSuE |
| food-fry | Ajeet Panesar | https://unsplash.com/photos/a-plate-of-food-_Tci2omfmHI |
| food-oats | Anastasia Eremina | https://unsplash.com/photos/sliced-apples-and-bananas-in-white-ceramic-bowl-QiN3ZBskOBY |
| food-yogurt | Shayna Douglas | https://unsplash.com/photos/a-bowl-of-cereal-with-blueberries-and-granola-z71M3cfW40c |
| food-smoothie | Doug Bagg | https://unsplash.com/photos/clear-cup-with-straw-on-beige-wooden-surface-1Add_A_10Lw |
| food-wrap | Yosia Cahyana | https://unsplash.com/photos/three-meat-and-lettuce-wraps-stacked-on-a-table-UmnvfuGPIuE |
| food-sandwich | Eiliv Aceron | https://unsplash.com/photos/black-plate-with-sandwich-mAQZ3X_8_l0 |
| food-soup | Elena Leya | https://unsplash.com/photos/creamy-pumpkin-soup-with-parsley-and-bread-JELuDsF96tA |
| food-pasta | Ben Lei | https://unsplash.com/photos/penne-pasta-with-meat-sauce-flFd8L7_B3g |
| food-curry | Roman Bonapart | https://unsplash.com/photos/white-ceramic-bowl-with-stainless-steel-spoon-rsgscg6sBDQ |
| food-noodles | Lindsay Moe | https://unsplash.com/photos/bowl-of-vegetable-UP5jWpuIvZI |
| food-traybake | Nick Nice | https://unsplash.com/photos/a-close-up-of-a-plate-of-food-with-meat-and-veggies--cLe54AcdYg |
| food-tacos | Robby McCullough | https://unsplash.com/photos/three-tacos-with-meat-lettuce-and-sauce-on-a-white-plate-oDC_9Uq1los |
| food-steak | Tim Toomey | https://unsplash.com/photos/grilled-meat-on-white-ceramic-plate-pe9dvM1rQkM |
| food-sausage | Adam Fathony | https://unsplash.com/photos/a-plate-with-sausages-mushrooms-and-mashed-potatoes-1vu9LPsNmrw |
| food-fish | Orkun Orcan | https://unsplash.com/photos/a-white-plate-topped-with-fish-and-vegetables-3ru16c1mSsU |
| food-potato | nobleseed nobleseed | https://unsplash.com/photos/baked-potato-with-melted-cheese-and-bacon-bits-TWA_MRXBpXY |
| food-snack | Pratik Bachhav | https://unsplash.com/photos/brown-and-black-nuts-on-white-ceramic-bowl-5p6B2SGx1qc |
| food-burger | David Foodphototasty | https://unsplash.com/photos/burger-with-lettuce-and-tomato-E94j3rMcxlw |
| slide-targets | Anh Nguyen | https://unsplash.com/photos/vegetable-and-meat-on-bowl-kcA-c3f_3FE |
| slide-meals | martin becker | https://unsplash.com/photos/burger-with-relish-bYKlXDxKVl8 |
| slide-price | Sara Scarpa | https://unsplash.com/photos/carrots-and-cucumber-on-brown-woven-basket-AJFQGDaFP-s |
| slide-trolley | Karsten Winegeart | https://unsplash.com/photos/a-person-pushing-a-shopping-cart-full-of-food-CZtK_E89omo |
