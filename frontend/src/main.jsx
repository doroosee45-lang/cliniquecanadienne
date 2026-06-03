// // import React from 'react';
// // import ReactDOM from 'react-dom/client';
// // import { BrowserRouter } from 'react-router-dom';
// // import { Provider } from 'react-redux';
// // import { Toaster } from 'react-hot-toast';
// // import App from './App';
// // import store from './store/store';
// // import './index.css';

// // ReactDOM.createRoot(document.getElementById('root')).render(
// //   <React.StrictMode>
// //     <Provider store={store}>
// //     <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
// //       <App />
// //       <Toaster
// //         position="bottom-center"
// //         toastOptions={{
// //           duration: 3500,
// //           style: {
// //             fontFamily: 'Poppins, sans-serif',
// //             fontSize: '0.875rem',
// //             fontWeight: '600',
// //             borderRadius: '14px',
// //             padding: '12px 20px',
// //           },
// //           success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
// //           error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
// //         }}
// //       />
// //     </BrowserRouter>
// //     </Provider>
// //   </React.StrictMode>
// // );





// import React from 'react';
// import ReactDOM from 'react-dom/client';
// import { BrowserRouter } from 'react-router-dom';
// import { Provider } from 'react-redux';
// import { Toaster } from 'react-hot-toast';
// import { GoogleOAuthProvider } from '@react-oauth/google';

// import App from './App';
// import store from './store/store';
// import './index.css';

// ReactDOM.createRoot(document.getElementById('root')).render(
//   <React.StrictMode>
//     <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
//       <Provider store={store}>
//         <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
//           <App />
//           <Toaster
//             position="bottom-center"
//             toastOptions={{
//               duration: 3500,
//               style: {
//                 fontFamily: 'Poppins, sans-serif',
//                 fontSize: '0.875rem',
//                 fontWeight: '600',
//                 borderRadius: '14px',
//                 padding: '12px 20px',
//               },
//               success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
//               error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
//             }}
//           />
//         </BrowserRouter>
//       </Provider>
//     </GoogleOAuthProvider>
//   </React.StrictMode>
// );


import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { Toaster } from 'react-hot-toast';

import App from './App';
import store from './store/store'; // ✅ chemin correct
import './index.css';

// ✅ Variable d'environnement Vite (doit être préfixée VITE_)
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

if (!GOOGLE_CLIENT_ID) {
  console.error(
    '[MediSync] ⚠️  VITE_GOOGLE_CLIENT_ID manquant dans .env\n' +
    'Ajoute : VITE_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com\n' +
    'puis redémarre Vite (Ctrl+C → npm run dev).'
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/*
      Ordre obligatoire :
      1. GoogleOAuthProvider  → doit englober tout (useGoogleLogin en a besoin)
      2. Provider (Redux)     → store global
      3. BrowserRouter        → routing
      4. App                  → contient déjà AuthProvider + AppRoutes
    */}
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID ?? ''}>
      <Provider store={store}>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <App />
          <Toaster
            position="bottom-center"
            toastOptions={{
              duration: 3500,
              style: {
                fontFamily: "'Poppins', sans-serif",
                fontSize: '0.875rem',
                fontWeight: '600',
                borderRadius: '14px',
                padding: '12px 20px',
                background: '#132744',
                color: '#fff',
                border: '1px solid rgba(14,165,160,.3)',
              },
              success: { iconTheme: { primary: '#0EA5A0', secondary: '#fff' } },
              error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
            }}
          />
        </BrowserRouter>
      </Provider>
    </GoogleOAuthProvider>
  </React.StrictMode>
);