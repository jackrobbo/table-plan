# CoFID source data

`cofid.json` is a compact extract (code, name, food group, kcal, protein g, fat g, carbohydrate g per 100 g edible portion)
of **McCance and Widdowson's Composition of Foods Integrated Dataset (CoFID) 2021**, published by the UK Health Security Agency
(formerly Public Health England).

Contains public sector information licensed under the Open Government Licence v3.0
(https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/). © Crown copyright.

Source: https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid

Values "Tr" (trace) are stored as 0. Foods missing any of the four values are omitted. Ingredient-to-CoFID matches are in
`content/cofid-map.json` and are judgement calls to be spot-checked by a dietitian.
