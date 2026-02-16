import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import './styles/global.css';
import './styles/animations.css';

// Code-split: BoardPage only loads on /board/:code route
const App = lazy(() => import('./components/App'));
const BoardPage = lazy(() => import('./components/BoardPage'));
const QuizPage = lazy(() => import('./components/QuizPage'));

// Minimal loading spinner for Suspense
function LoadingFallback() {
  return (
    <div style={{
      width: '100%',
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(160deg, #FFE5D9 0%, #D4E4F7 100%)',
    }}>
      <div style={{
        fontFamily: "'Fredoka', sans-serif",
        fontSize: 20,
        color: '#8B5A2B',
        animation: 'pulse 1.5s ease-in-out infinite',
      }}>
        Laden...
      </div>
    </div>
  );
}

// Simple path-based routing: /board/:code → BoardPage, everything else → App
function Root() {
  const path = window.location.pathname;
  const boardMatch = path.match(/^\/board\/([A-Za-z0-9]+)/);
  if (boardMatch) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <BoardPage code={boardMatch[1].toUpperCase()} />
      </Suspense>
    );
  }
  const quizMatch = path.match(/^\/quiz\/([A-Za-z0-9]+)/);
  if (quizMatch) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <QuizPage code={quizMatch[1].toUpperCase()} />
      </Suspense>
    );
  }
  return (
    <Suspense fallback={<LoadingFallback />}>
      <App />
    </Suspense>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
