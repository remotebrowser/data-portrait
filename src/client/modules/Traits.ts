export type Trait = {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
};

export const TRAITS_OPTIONS: Trait[] = [
  {
    id: 'middle-eastern',
    name: 'Middle Eastern',
    description: 'Middle Eastern ethnicity',
    icon: '🌍',
    category: 'ethnicity',
  },
  {
    id: 'east-asian',
    name: 'East Asian',
    description: 'East Asian ethnicity',
    icon: '🌏',
    category: 'ethnicity',
  },
  {
    id: 'south-asian',
    name: 'South Asian',
    description: 'South Asian ethnicity',
    icon: '🌏',
    category: 'ethnicity',
  },
  {
    id: 'african',
    name: 'African',
    description: 'African ethnicity',
    icon: '🌍',
    category: 'ethnicity',
  },
  {
    id: 'hispanic-latino',
    name: 'Hispanic/Latino',
    description: 'Hispanic or Latino ethnicity',
    icon: '🌎',
    category: 'ethnicity',
  },
  {
    id: 'curly-black-hair',
    name: 'Curly Black Hair',
    description: 'Distinctive curly black hair',
    icon: '🌀',
    category: 'hair',
  },
  {
    id: 'straight-blonde-hair',
    name: 'Straight Blonde Hair',
    description: 'Straight blonde hair',
    icon: '💛',
    category: 'hair',
  },
  {
    id: 'wavy-brown-hair',
    name: 'Wavy Brown Hair',
    description: 'Wavy brown hair',
    icon: '🌊',
    category: 'hair',
  },
  {
    id: 'red-hair',
    name: 'Red Hair',
    description: 'Red or ginger hair',
    icon: '🔥',
    category: 'hair',
  },
  {
    id: 'glasses',
    name: 'Glasses',
    description: 'Wears glasses or spectacles',
    icon: '👓',
    category: 'features',
  },
  {
    id: 'beard',
    name: 'Beard',
    description: 'Has facial hair or beard',
    icon: '🧔',
    category: 'features',
  },
  {
    id: 'young-adult',
    name: 'Young Adult',
    description: 'Young adult appearance (20s-30s)',
    icon: '👶',
    category: 'age',
  },
  {
    id: 'middle-aged',
    name: 'Middle-aged',
    description: 'Middle-aged appearance (40s-50s)',
    icon: '👨',
    category: 'age',
  },
];
