import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import { ThemeProvider } from './design-system/theme-provider';
import { ToastProvider } from './design-system/toast-provider';
import './index.css';

createRoot(document.getElementById('root')!).render(
	<ThemeProvider>
		<ToastProvider>
			<BrowserRouter>
				<App />
			</BrowserRouter>
		</ToastProvider>
	</ThemeProvider>
);
