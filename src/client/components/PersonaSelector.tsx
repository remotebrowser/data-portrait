import Select, {
  components,
  type MultiValue,
  type StylesConfig,
} from 'react-select';
import { IMAGE_STYLES } from '../modules/ImageStyle.js';
import { TRAITS_OPTIONS } from '../modules/Traits.js';
import { GENDER_OPTIONS } from '../modules/Gender.js';

export type PersonaOptionKind = 'gender' | 'style' | 'trait';

export type PersonaOption = {
  kind: PersonaOptionKind;
  id: string;
  label: string;
  description: string;
  icon?: string;
  gradient?: string;
};

type PersonaSelectorProps = {
  gender: string;
  imageStyles: string[];
  traits: string[];
  onGenderChange: (gender: string) => void;
  onImageStylesChange: (styles: string[]) => void;
  onTraitsChange: (traits: string[]) => void;
};

// Build unified options list
const GENDER_OPTIONS_MAPPED: PersonaOption[] = GENDER_OPTIONS.map((g) => ({
  kind: 'gender',
  id: g.id,
  label: g.name,
  description: g.description,
  icon: g.icon,
  gradient: g.gradient,
}));

const STYLE_OPTIONS: PersonaOption[] = IMAGE_STYLES.map((s) => ({
  kind: 'style',
  id: s.id,
  label: s.name,
  description: s.description,
  icon: s.preview,
  gradient: s.gradient,
}));

const TRAIT_OPTIONS: PersonaOption[] = TRAITS_OPTIONS.map((t) => ({
  kind: 'trait',
  id: t.id,
  label: t.name,
  description: t.description,
  icon: t.icon,
}));

const ALL_OPTIONS: PersonaOption[] = [
  ...GENDER_OPTIONS_MAPPED,
  ...STYLE_OPTIONS,
  ...TRAIT_OPTIONS,
];

export function PersonaSelector({
  gender,
  imageStyles,
  traits,
  onGenderChange,
  onImageStylesChange,
  onTraitsChange,
}: PersonaSelectorProps) {
  // Build current value from existing state
  const value: PersonaOption[] = [
    ...ALL_OPTIONS.filter((o) => o.kind === 'gender' && o.id === gender),
    ...ALL_OPTIONS.filter(
      (o) => o.kind === 'style' && imageStyles.includes(o.id)
    ),
    ...ALL_OPTIONS.filter((o) => o.kind === 'trait' && traits.includes(o.id)),
  ];

  const handleChange = (selected: MultiValue<PersonaOption>) => {
    const selectedArray = selected as PersonaOption[];

    // Extract gender options from selection
    const genderOptions = selectedArray.filter((o) => o.kind === 'gender');

    // Handle gender: only keep the most recently selected one
    let newGender = gender; // default to current

    if (genderOptions.length === 0) {
      // User removed gender chip - keep current gender, don't allow removing it
      newGender = gender;
    } else if (genderOptions.length === 1) {
      // Single gender selected
      newGender = genderOptions[0].id;
    } else {
      // Multiple genders selected (user just picked a new one while old one was there)
      // Find which one is NEW (not equal to current gender)
      const newGenderOption = genderOptions.find((g) => g.id !== gender);
      newGender = newGenderOption ? newGenderOption.id : genderOptions[0].id;
    }

    // Extract styles
    const newImageStyles = selectedArray
      .filter((o) => o.kind === 'style')
      .map((o) => o.id);

    // Extract traits
    const newTraits = selectedArray
      .filter((o) => o.kind === 'trait')
      .map((o) => o.id);

    // Update all three pieces of state
    onGenderChange(newGender);
    onImageStylesChange(newImageStyles);
    onTraitsChange(newTraits);
  };

  const customStyles: StylesConfig<PersonaOption, true> = {
    control: (base, state) => ({
      ...base,
      borderColor: state.isFocused ? '#2563eb' : '#e5e7eb',
      boxShadow: state.isFocused ? '0 0 0 1px #2563eb' : 'none',
      '&:hover': {
        borderColor: '#2563eb',
      },
      minHeight: '2.5rem',
      cursor: 'text',
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected
        ? '#dbeafe'
        : state.isFocused
          ? '#f3f4f6'
          : 'white',
      color: '#111827',
      cursor: 'pointer',
      padding: '8px 12px',
    }),
    menu: (base) => ({
      ...base,
      zIndex: 50,
      boxShadow:
        '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    }),
    menuList: (base) => ({
      ...base,
      maxHeight: '300px',
    }),
    multiValue: (base) => ({
      ...base,
      backgroundColor: '#f3f4f6',
      borderRadius: '6px',
    }),
    multiValueLabel: (base) => ({
      ...base,
      fontWeight: 500,
      padding: '2px 6px',
    }),
    multiValueRemove: (base) => ({
      ...base,
      cursor: 'pointer',
      '&:hover': {
        backgroundColor: '#e5e7eb',
        color: '#374151',
      },
    }),
  };

  const Option = (props: any) => {
    const { data, isSelected } = props;
    const option = data as PersonaOption;

    return (
      <components.Option {...props}>
        <div className="flex items-center gap-3 py-1">
          {option.icon && (
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
                option.gradient
                  ? `bg-gradient-to-br ${option.gradient}`
                  : 'bg-gray-100'
              }`}
            >
              {option.icon}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-gray-900">
              {option.label}
            </div>
            <div className="text-xs text-gray-500">{option.description}</div>
          </div>
          {isSelected && (
            <div className="ml-auto flex-shrink-0">
              <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                <svg
                  className="w-3 h-3 text-white"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>
          )}
        </div>
      </components.Option>
    );
  };

  const MultiValueLabel = (props: any) => {
    const option = props.data as PersonaOption;
    return (
      <components.MultiValueLabel {...props}>
        <div className="flex items-center gap-1">
          {option.icon && <span className="text-xs">{option.icon}</span>}
          <span>{option.label}</span>
        </div>
      </components.MultiValueLabel>
    );
  };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Portrait Description</h2>
      <p className="text-xs text-gray-500 mb-3">
        Type to add gender, image styles, and traits. Start typing to search...
      </p>

      <Select
        isMulti
        isSearchable
        options={ALL_OPTIONS}
        value={value}
        onChange={handleChange}
        getOptionValue={(option) => `${option.kind}-${option.id}`}
        getOptionLabel={(option) => option.label}
        placeholder="Click to select or type to search..."
        className="text-sm"
        classNamePrefix="persona-select"
        isClearable={false}
        closeMenuOnSelect={false}
        hideSelectedOptions={false}
        menuPortalTarget={document.body}
        styles={{
          ...customStyles,
          menuPortal: (base) => ({ ...base, zIndex: 9999 }),
        }}
        components={{
          Option,
          MultiValueLabel,
        }}
        noOptionsMessage={() => 'No options found'}
      />

      {/* Helper text */}
      {value.length === 0 && (
        <div className="mt-3 p-2 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-600">
            Select attributes to describe your portrait
          </p>
        </div>
      )}
    </div>
  );
}
