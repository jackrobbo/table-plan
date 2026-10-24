import { describe, expect, it } from 'vitest';
import { parseDeclaredAllergens, parseNutritionTable } from './nutrition';

const wrap = (rows: string) => `<table class="nutrition"><tbody>${rows}</tbody></table>`;

describe('parseNutritionTable', () => {
  it('reads kcal from its own row and picks the per-100g column, not per-portion', () => {
    const html = wrap(`
      <tr><th>Typical Values</th><th>(as sold) per 100g</th><th>(as sold) per 40g portion</th><th>per 40g portion %RI</th><th>your RI*</th></tr>
      <tr><td>Energy</td><td>1543kJ</td><td>617kJ</td><td></td><td>8400kJ/</td></tr>
      <tr><td></td><td>367kcal</td><td>147kcal</td><td>7%</td><td>2000kcal</td></tr>
      <tr><td>Fat</td><td>8.4g</td><td>3.4g</td><td>5%</td><td>70g</td></tr>
      <tr><td>of which saturates</td><td>1.3g</td><td>0.5g</td><td>3%</td><td>20g</td></tr>
      <tr><td>Carbohydrate</td><td>56.1g</td><td>22.4g</td><td></td><td></td></tr>
      <tr><td>Fibre</td><td>9.1g</td><td>3.6g</td><td></td><td></td></tr>
      <tr><td>Protein</td><td>12.1g</td><td>4.8g</td><td></td><td></td></tr>`);
    expect(parseNutritionTable(html)).toEqual({ kcal: 367, protein_g: 12.1, carbs_g: 56.1, fat_g: 8.4, basis: '(as sold) per 100g' });
  });
  it('reads "753kJ/179kcal" in one cell and treats nil as 0', () => {
    const html = wrap(`
      <tr><th>Typical Values</th><th>(as sold) per 100g</th><th>%RI</th><th>your RI*</th></tr>
      <tr><td>Energy</td><td>753kJ/179kcal</td><td>9%</td><td>8400kJ/2000kcal</td></tr>
      <tr><td>Fat</td><td>5g</td><td>7%</td><td>70g</td></tr>
      <tr><td>Carbohydrate</td><td>nil</td><td></td><td></td></tr>
      <tr><td>Protein</td><td>33.2g</td><td></td><td></td></tr>`);
    expect(parseNutritionTable(html)).toMatchObject({ kcal: 179, fat_g: 5, carbs_g: 0, protein_g: 33.2 });
  });
  it('returns null when there is no table, no per-100 column, or a macro is missing', () => {
    expect(parseNutritionTable('<p>no table</p>')).toBeNull();
    expect(parseNutritionTable(wrap('<tr><th>Typical Values</th><th>per portion</th></tr><tr><td>Fat</td><td>1g</td></tr>'))).toBeNull();
    expect(parseNutritionTable(wrap('<tr><th>Typical Values</th><th>per 100g</th></tr><tr><td>Energy</td><td>100kcal</td></tr>'))).toBeNull();
  });
});

describe('parseDeclaredAllergens', () => {
  const page = (inner: string) => `<h2>Ingredients (ingredients and allergens may be subject to change, so it is important you check the labels supplied in each delivery).</h2><div class="x">${inner}</div><div>`;
  it('maps bold terms to the 14 allergens', () => {
    expect(parseDeclaredAllergens(page('Pork (72%), Wheat Flour (<b>Wheat</b> Flour, Calcium), Preservative (Sodium <b>Metabisulphite</b>)'))).toEqual(['gluten', 'sulphites']);
    expect(parseDeclaredAllergens(page('<b>Milk</b>, <b>Egg</b>, <b>Soya</b> Lecithin, <b>Oats</b>'))).toEqual(['eggs', 'gluten', 'milk', 'soya']);
  });
  it('is empty when nothing is bold, and null when there is no ingredients list', () => {
    expect(parseDeclaredAllergens(page('Water, Tomato Paste (14%), Onion'))).toEqual([]);
    expect(parseDeclaredAllergens('<p>loose carrots</p>')).toBeNull();
  });
});
