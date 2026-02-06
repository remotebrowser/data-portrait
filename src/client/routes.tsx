import { createBrowserRouter } from 'react-router-dom';
import { DataPortrait } from './pages/DataPortrait.js';
import { StoryPage } from './pages/StoryPage.js';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <DataPortrait />,
  },
  {
    path: '/story/:storyId',
    element: <StoryPage />,
  },
]);
