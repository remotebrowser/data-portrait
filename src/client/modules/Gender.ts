type Gender = {
  id: string;
  name: string;
  description: string;
  icon: string;
  gradient: string;
};

export const GENDER_OPTIONS: Array<Gender> = [
  {
    id: 'Female',
    name: 'Female',
    description: 'Female representation',
    icon: '👩',
    gradient: 'from-pink-100 to-rose-200',
  },
  {
    id: 'Male',
    name: 'Male',
    description: 'Male representation',
    icon: '👨',
    gradient: 'from-blue-100 to-indigo-200',
  },
  {
    id: 'Other',
    name: 'Other',
    description: 'Non-binary representation',
    icon: '🧑',
    gradient: 'from-purple-100 to-violet-200',
  },
];

export function getRandomGender(): string {
  return GENDER_OPTIONS[Math.floor(Math.random() * GENDER_OPTIONS.length)].id;
}
