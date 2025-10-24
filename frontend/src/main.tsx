import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

// 👇 Importa aquí tus estilos globales (con Tailwind o CSS base)
import './styles/index.css';

// ⚙️ Render principal de la aplicación
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
