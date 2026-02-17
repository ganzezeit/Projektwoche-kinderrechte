import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import './styles/global.css';
import './styles/animations.css';

// Code-split: BoardPage only loads on /board/:code route
const App = lazy(() => import('./components/App'));
const BoardPage = lazy(() => import('./components/BoardPage'));
const ChatPage = lazy(() => import('./components/ChatPage'));
const QuizPage = lazy(() => import('./components/QuizPage'));
const EinzelquizPage = lazy(() => import('./components/EinzelquizPage'));
const ArtRoomPage = lazy(() => import('./components/ArtRoomPage'));

// Print fix: overlays inside #root get hidden when #root content is hidden.
// Solution: clone the printable overlay to document.body, hide #root, print.
let printClone = null;
window.addEventListener('beforeprint', () => {
  const overlay = document.querySelector(
    '.board-overlay, .quiz-dialog-overlay, .quiz-analysis-overlay, .weekly-report-overlay'
  );
  if (!overlay) return;
  const root = document.getElementById('root');
  // Only clone if overlay is inside #root (portaled overlays are already outside)
  if (root && root.contains(overlay)) {
    printClone = overlay.cloneNode(true);
    printClone.classList.add('print-clone');
    document.body.appendChild(printClone);
  }
  document.documentElement.classList.add('printing-overlay');
});
window.addEventListener('afterprint', () => {
  document.documentElement.classList.remove('printing-overlay');
  if (printClone) { printClone.remove(); printClone = null; }
});

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
  const chatMatch = path.match(/^\/chat\/([A-Za-z0-9]+)/);
  if (chatMatch) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <ChatPage roomCode={chatMatch[1].toUpperCase()} />
      </Suspense>
    );
  }
  const einzelquizMatch = path.match(/^\/einzelquiz\/([A-Za-z0-9_-]+)/);
  if (einzelquizMatch) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <EinzelquizPage quizId={einzelquizMatch[1]} />
      </Suspense>
    );
  }
  const artMatch = path.match(/^\/art\/([A-Za-z0-9]+)/);
  if (artMatch) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <ArtRoomPage code={artMatch[1].toUpperCase()} />
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
