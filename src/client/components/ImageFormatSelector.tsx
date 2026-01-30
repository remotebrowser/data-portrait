import { Image, Grid3x3 } from 'lucide-react';
import { cn } from '@/lib/utils.js';
import type { ImageFormat } from '../modules/PortraitGeneration.js';

type ImageFormatSelectorProps = {
  value: ImageFormat;
  onChange: (value: ImageFormat) => void;
};

type FormatOption = {
  id: ImageFormat;
  label: string;
  description: string;
  icon: typeof Image | typeof Grid3x3;
};

const FORMAT_OPTIONS: FormatOption[] = [
  {
    id: 'single',
    label: 'Single Image',
    description: 'Generate one portrait image',
    icon: Image,
  },
  {
    id: 'stories',
    label: 'Stories',
    description: 'Generate multiple images like Instagram stories',
    icon: Grid3x3,
  },
];

export function ImageFormatSelector({
  value,
  onChange,
}: ImageFormatSelectorProps) {
  const handleOptionClick = (optionId: ImageFormat) => {
    onChange(optionId);
  };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Image Format</h2>
      <p className="text-xs text-gray-500 mb-3">
        Choose between generating a single image or multiple story images
      </p>

      <div className="grid grid-cols-2 gap-3">
        {FORMAT_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isSelected = value === option.id;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => handleOptionClick(option.id)}
              className={cn(
                'relative flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all duration-200 cursor-pointer',
                'hover:shadow-md hover:border-blue-300',
                isSelected
                  ? 'border-blue-500 bg-blue-50 shadow-sm'
                  : 'border-gray-200 bg-white'
              )}
              aria-pressed={isSelected}
            >
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-colors',
                  isSelected ? 'bg-blue-100' : 'bg-gray-100'
                )}
              >
                <Icon
                  className={cn(
                    'w-5 h-5',
                    isSelected ? 'text-blue-600' : 'text-gray-600'
                  )}
                />
              </div>
              <div className="text-sm font-medium text-gray-900 mb-1">
                {option.label}
              </div>
              <div className="text-xs text-gray-500 text-center">
                {option.description}
              </div>
              {isSelected && (
                <div className="absolute top-2 right-2">
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
            </button>
          );
        })}
      </div>
    </div>
  );
}
