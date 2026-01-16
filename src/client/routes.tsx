import { createBrowserRouter } from 'react-router-dom';
import { DataPortrait } from './pages/DataPortrait.js';
import { SharedPortrait } from './pages/SharedPortrait.js';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <DataPortrait />,
  },
  {
    path: '/shared/:filename',
    element: <SharedPortrait />,
  },
]);
