import { createBrowserRouter } from 'react-router-dom';
import { DataPortrait } from './pages/DataPortrait.js';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <DataPortrait />,
  },
]);
