import { useSearchParams } from 'react-router-dom';

/**
 * Feature flag hook for the stories feature.
 * Returns true when ?story=1 query parameter is present.
 *
 * @returns boolean - true if stories feature is enabled via query param
 *
 * TODO: Remove this hook once stories feature is fully released
 */
export function useStoryFeatureFlag(): boolean {
  const [searchParams] = useSearchParams();
  return searchParams.get('story') === '1';
}
