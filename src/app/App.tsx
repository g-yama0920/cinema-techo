import { RouterProvider } from 'react-router';
import { repository } from '../data';
import { LibraryProvider } from '../data/LibraryProvider';
import { ToastProvider } from '../ui/Toast';
import { router } from './router';

export function App() {
  return (
    <ToastProvider>
      <LibraryProvider repo={repository}>
        <RouterProvider router={router} />
      </LibraryProvider>
    </ToastProvider>
  );
}
