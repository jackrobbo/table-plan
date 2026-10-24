/** Food-type groups for the dislikes step. Dislikes only lower ranking; they never hard-exclude. */
export const DISLIKE_GROUPS: { group: string; items: string[] }[] = [
  { group: 'Poultry', items: ['Chicken', 'Turkey', 'Duck'] },
  { group: 'Red meat', items: ['Beef', 'Lamb', 'Pork', 'Bacon', 'Ham', 'Sausages', 'Liver'] },
  { group: 'Fish & seafood', items: ['Salmon', 'White fish', 'Tuna', 'Prawns', 'Mussels', 'Smoked fish'] },
  { group: 'Dairy & eggs', items: ['Eggs', 'Cheese', 'Yogurt', 'Cream', 'Butter'] },
  { group: 'Veg', items: ['Onions', 'Peppers', 'Mushrooms', 'Tomatoes', 'Broccoli', 'Cauliflower', 'Spinach', 'Courgette', 'Aubergine', 'Cabbage', 'Sweetcorn', 'Carrots', 'Peas', 'Beetroot', 'Celery', 'Cucumber', 'Olives', 'Avocado'] },
  { group: 'Pulses', items: ['Kidney beans', 'Chickpeas', 'Lentils', 'Baked beans'] },
  { group: 'Carbs', items: ['Rice', 'Pasta', 'Noodles', 'Potatoes', 'Bread', 'Wraps'] },
  { group: 'Fruit', items: ['Banana', 'Berries', 'Apple', 'Citrus', 'Dried fruit'] },
  { group: 'Flavours', items: ['Spicy food', 'Garlic', 'Coriander', 'Mustard', 'Curry', 'Soy sauce'] },
  { group: 'Other', items: ['Nuts', 'Tofu', 'Protein shakes'] },
];
export const ALL_DISLIKES = DISLIKE_GROUPS.flatMap((g) => g.items);
