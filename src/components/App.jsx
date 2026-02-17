import React, { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
import { DAYS } from '../data/days';
import { loadState, saveState, resetState } from '../utils/persistence';
import { setVolume, playClickSound, playSuccessSound, playCompleteSound } from '../utils/audio';
import { audioManager } from '../utils/audioManager';
import { LOW_ENERGY_THRESHOLD, MAX_ENERGY } from '../utils/constants';
import { useProject } from '../contexts/ProjectContext';

// Eager: always visible or on first screen
import SplashScreen from './SplashScreen';
import MapScreen from './MapScreen';
import AnimatedBackground from './AnimatedBackground';
import TopBar from './TopBar';
import Confetti from './Confetti';

// Lazy: loaded on demand when screen/feature is needed
const WochenplanScreen = lazy(() => import('./WochenplanScreen'));
const ProjektregelnScreen = lazy(() => import('./ProjektregelnScreen'));
const EnergizerIchStimmeZu = lazy(() => import('./EnergizerIchStimmeZu'));
const LernkartenGame = lazy(() => import('./LernkartenGame'));
const EinzelquizStepCard = lazy(() => import('./EinzelquizStepCard'));
const DayScreen = lazy(() => import('./DayScreen'));
const DayIntroScreen = lazy(() => import('./DayIntroScreen'));
const StepViewer = lazy(() => import('./StepViewer'));
const EnergizerScreen = lazy(() => import('./EnergizerScreen'));
const TeacherPanel = lazy(() => import('./TeacherPanel'));
const QuickBoardDialog = lazy(() => import('./QuickBoardDialog'));
const QuizDialog = lazy(() => import('./QuizDialog'));
const ChatManager = lazy(() => import('./ChatManager'));
const ArtStudio = lazy(() => import('./ArtStudio'));
const WeeklyReport = lazy(() => import('./WeeklyReport'));
const EnergizerPopup = lazy(() => import('./EnergizerPopup'));

/*
  Screen flow:
  splash → wochenplan → projektregeln → ichStimmeZu → lernkarten → map
  map ↔ dayIntro → day → step
  day ↔ energizer
*/

const TRANSITION_MS = 400;

export default function App() {
  const [state, setState] = useState(() => loadState());
  const [screen, setScreen] = useState('splash');
  const [selectedDay, setSelectedDay] = useState(null);
  const [viewingStepIndex, setViewingStepIndex] = useState(null);
  const [showTeacherPanel, setShowTeacherPanel] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [pendingStepAfterEnergizer, setPendingStepAfterEnergizer] = useState(null);
  const [energyFloat, setEnergyFloat] = useState(null);
  const [showQuickBoard, setShowQuickBoard] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [artStudioMode, setArtStudioMode] = useState(null); // null | 'room' | 'studio'
  const [showWeeklyReport, setShowWeeklyReport] = useState(false);
  const [showEnergizerPopup, setShowEnergizerPopup] = useState(false);
  const [freeEnergizer, setFreeEnergizer] = useState(false);
  const [freeEnergizerData, setFreeEnergizerData] = useState(null);
  const screenBeforeFreeEnergizer = useRef(null);

  // Project context — className comes from selected project
  const { project, clearProject } = useProject();
  const className = project?.className || null;
  const isRemoteUpdateRef = useRef(false);

  // Save status tracking
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [lastSaveTimestamp, setLastSaveTimestamp] = useState(null);
  const saveResetTimerRef = useRef(null);

  // Transition state
  const [transitionPhase, setTransitionPhase] = useState('visible'); // 'visible' | 'fading-out' | 'fading-in'
  const pendingScreen = useRef(null);
  const pendingSfx = useRef(null);

  const transitionTo = useCallback((newScreen, sfxName) => {
    if (transitionPhase !== 'visible') {
      // If mid-transition, just switch immediately
      setScreen(newScreen);
      return;
    }
    pendingScreen.current = newScreen;
    pendingSfx.current = sfxName || null;
    setTransitionPhase('fading-out');
  }, [transitionPhase]);

  // Handle fade-out → switch screen → fade-in
  useEffect(() => {
    if (transitionPhase === 'fading-out') {
      const timer = setTimeout(() => {
        if (pendingScreen.current !== null) {
          setScreen(pendingScreen.current);
          pendingScreen.current = null;
        }
        if (pendingSfx.current) {
          audioManager.playSfx(pendingSfx.current);
          pendingSfx.current = null;
        }
        setTransitionPhase('fading-in');
      }, TRANSITION_MS);
      return () => clearTimeout(timer);
    }
    if (transitionPhase === 'fading-in') {
      const timer = setTimeout(() => {
        setTransitionPhase('visible');
      }, TRANSITION_MS);
      return () => clearTimeout(timer);
    }
  }, [transitionPhase]);

  const screenOpacity = transitionPhase === 'fading-out' ? 0 : 1;

  // Save result callback
  const handleSaveResult = useCallback(({ success, timestamp }) => {
    if (saveResetTimerRef.current) clearTimeout(saveResetTimerRef.current);
    if (success) {
      setSaveStatus('saved');
      setLastSaveTimestamp(timestamp);
    } else {
      setSaveStatus('error');
    }
    saveResetTimerRef.current = setTimeout(() => setSaveStatus('idle'), 3000);
  }, []);

  // Manual force save
  const handleForceSave = useCallback(async () => {
    if (!className) return false;
    setSaveStatus('saving');
    try {
      const { forceSaveClassState } = await import('../utils/firebasePersistence');
      const ok = await forceSaveClassState(className, state);
      if (saveResetTimerRef.current) clearTimeout(saveResetTimerRef.current);
      if (ok) {
        setSaveStatus('saved');
        setLastSaveTimestamp(Date.now());
      } else {
        setSaveStatus('error');
      }
      saveResetTimerRef.current = setTimeout(() => setSaveStatus('idle'), 3000);
      return ok;
    } catch {
      setSaveStatus('error');
      if (saveResetTimerRef.current) clearTimeout(saveResetTimerRef.current);
      saveResetTimerRef.current = setTimeout(() => setSaveStatus('idle'), 3000);
      return false;
    }
  }, [className, state]);

  // Persist on every state change (localStorage always as fallback)
  useEffect(() => { saveState(state); }, [state]);
  useEffect(() => { setVolume(state.volume); }, [state.volume]);

  // F4: Firebase sync — subscribe to class state (dynamic import: Firebase loads only when needed)
  useEffect(() => {
    if (!className) return;
    let unsub = () => {};
    let cancelled = false;
    import('../utils/firebasePersistence').then(({ subscribeToClass, setIsRemoteUpdate: setRemote, getLastUpdated }) => {
      if (cancelled) return;
      // Populate initial lastSaveTimestamp
      getLastUpdated(className).then((ts) => {
        if (!cancelled && ts) setLastSaveTimestamp(ts);
      });
      unsub = subscribeToClass(className, (remoteState) => {
        if (remoteState === null) return; // New class — no data yet
        try {
          isRemoteUpdateRef.current = true;
          setRemote(true);
          setState(prev => ({
            ...remoteState,
            volume: prev.volume,
            completedDays: Array.isArray(remoteState.completedDays) ? remoteState.completedDays : [],
            usedEnergizers: Array.isArray(remoteState.usedEnergizers) ? remoteState.usedEnergizers : [],
            completedSteps: (remoteState.completedSteps && typeof remoteState.completedSteps === 'object') ? remoteState.completedSteps : {},
            dayIntroSeen: (remoteState.dayIntroSeen && typeof remoteState.dayIntroSeen === 'object') ? remoteState.dayIntroSeen : {},
          }));
        } catch (err) {
          console.error('[App] Error applying remote state:', err);
        }
        setTimeout(() => { isRemoteUpdateRef.current = false; setRemote(false); }, 100);
      });
    }).catch(err => console.error('[App] Firebase load error:', err));
    return () => { cancelled = true; unsub(); };
  }, [className]);

  // F4: Firebase sync — save state to Firebase on changes (dynamic import)
  useEffect(() => {
    if (!className) return;
    if (isRemoteUpdateRef.current) return;
    setSaveStatus('saving');
    import('../utils/firebasePersistence').then(({ saveClassState }) => {
      if (!isRemoteUpdateRef.current) saveClassState(className, state, handleSaveResult);
    }).catch(err => console.error('[App] Firebase save error:', err));
  }, [state, className, handleSaveResult]);

  // Pre-init audioManager on mount (async, no user gesture needed)
  useEffect(() => {
    audioManager.init();
  }, []);

  // Start music on first user interaction anywhere on the page
  useEffect(() => {
    let started = false;
    const startMusic = (e) => {
      if (started) return;
      started = true;
      audioManager.playMenu();
      cleanup();
    };
    const cleanup = () => {
      document.removeEventListener('click', startMusic);
      document.removeEventListener('keydown', startMusic);
      document.removeEventListener('touchstart', startMusic);
    };
    document.addEventListener('click', startMusic);
    document.addEventListener('keydown', startMusic);
    document.addEventListener('touchstart', startMusic);
    return cleanup;
  }, []);

  const getDayData = useCallback((dayId) => {
    return DAYS.find(d => d.id === (dayId || selectedDay || state.currentDay));
  }, [selectedDay, state.currentDay]);

  const getActiveStepIndex = useCallback((dayId) => {
    const day = DAYS.find(d => d.id === dayId);
    if (!day) return 0;
    for (let i = 0; i < day.steps.length; i++) {
      if (!state.completedSteps[day.steps[i].id]) return i;
    }
    return day.steps.length;
  }, [state.completedSteps]);

  const isDayCompleted = useCallback((dayId) => {
    const day = DAYS.find(d => d.id === dayId);
    if (!day) return false;
    return day.steps.every(s => state.completedSteps[s.id]);
  }, [state.completedSteps]);

  // -- Intro flow handlers --
  // Prefetch critical chunks while on splash screen
  useEffect(() => {
    if (screen === 'splash') {
      // Prefetch DayScreen + StepViewer (biggest chunks) in background
      import('./DayScreen').catch(() => {});
      import('./StepViewer').catch(() => {});
    }
  }, [screen]);

  const handleSplashStart = () => {
    playClickSound();
    // Ensure music is playing — playMenu() is a no-op if already playing
    audioManager.playMenu();
    if (!state.introCompleted) {
      transitionTo('wochenplan', 'transition-enter');
    } else {
      transitionTo('map', 'transition-enter');
    }
  };

  const handleWochenplanDone = () => transitionTo('projektregeln');
  const handleProjektregelnDone = () => transitionTo('ichStimmeZu');
  const handleIchStimmeZuDone = () => transitionTo('lernkarten');
  const handleLernkartenDone = () => {
    playSuccessSound();
    setState(prev => ({ ...prev, introCompleted: true }));
    transitionTo('map', 'transition-enter');
  };

  // -- Map / Day handlers --
  const handleDayClick = (dayId) => {
    setSelectedDay(dayId);
    const day = DAYS.find(d => d.id === dayId);
    if (day?.dayIntro && !state.dayIntroSeen[dayId]) {
      transitionTo('dayIntro', 'transition-enter');
    } else {
      transitionTo('day', 'transition-enter');
    }
  };

  const handleDayIntroDone = () => {
    setState(prev => ({
      ...prev,
      dayIntroSeen: { ...prev.dayIntroSeen, [selectedDay]: true }
    }));
    transitionTo('day');
  };

  const handleStepClick = (stepIndex) => {
    const day = getDayData();
    if (!day) return;
    const step = day.steps[stepIndex];
    if (!step) return;

    if (state.energy < LOW_ENERGY_THRESHOLD) {
      setPendingStepAfterEnergizer(stepIndex);
      transitionTo('energizer');
      return;
    }

    setState(prev => ({
      ...prev,
      energy: Math.max(0, prev.energy - step.energyCost)
    }));

    setViewingStepIndex(stepIndex);
    transitionTo('step', 'transition-enter');
    // Track task start timing
    if (className) {
      import('../utils/firebasePersistence').then(({ saveTaskTiming }) => {
        saveTaskTiming(className, step.id, 'startedAt');
      }).catch(() => {});
    }
  };

  const handleStepComplete = () => {
    const day = getDayData();
    if (!day || viewingStepIndex === null) return;
    const step = day.steps[viewingStepIndex];

    audioManager.playSfx('step-complete');
    playSuccessSound();

    const newCompleted = { ...state.completedSteps, [step.id]: true };
    const newState = { ...state, completedSteps: newCompleted };

    const allDone = day.steps.every(s => newCompleted[s.id]);
    if (allDone && !state.completedDays.includes(day.id)) {
      newState.completedDays = [...state.completedDays, day.id];
      if (day.id < DAYS.length) {
        newState.currentDay = Math.max(state.currentDay, day.id + 1);
      }
      audioManager.playSfx('day-unlock');
      playCompleteSound();
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3500);
    }

    setState(newState);
    // Track task completion timing
    if (className) {
      import('../utils/firebasePersistence').then(({ saveTaskTiming }) => {
        saveTaskTiming(className, step.id, 'completedAt');
      }).catch(() => {});
    }
    setViewingStepIndex(null);
    transitionTo('day');
  };

  const handleStepBack = () => {
    playClickSound();
    setViewingStepIndex(null);
    transitionTo('day', 'transition-back');
  };

  const handleEnergizerComplete = (energizer) => {
    // Free energizer: no state changes, return to previous screen
    if (freeEnergizer) {
      setFreeEnergizer(false);
      setFreeEnergizerData(null);
      const returnScreen = screenBeforeFreeEnergizer.current || 'map';
      screenBeforeFreeEnergizer.current = null;
      transitionTo(returnScreen);
      return;
    }

    const reward = energizer.energyReward;

    setEnergyFloat(`+${reward} Energie!`);
    setTimeout(() => setEnergyFloat(null), 1500);

    const newEnergy = Math.min(MAX_ENERGY, state.energy + reward);
    setState(prev => ({
      ...prev,
      energy: newEnergy,
      usedEnergizers: [...prev.usedEnergizers, energizer.id]
    }));

    if (pendingStepAfterEnergizer !== null) {
      const day = getDayData();
      const step = day?.steps[pendingStepAfterEnergizer];
      if (step) {
        // Energy reward already applied in setState above; only deduct step cost here
        setState(prev => ({
          ...prev,
          energy: Math.max(0, prev.energy - step.energyCost),
        }));
        setViewingStepIndex(pendingStepAfterEnergizer);
        setPendingStepAfterEnergizer(null);
        transitionTo('step');
        return;
      }
    }
    setPendingStepAfterEnergizer(null);
    transitionTo('day');
  };

  const handleBackToMap = () => {
    playClickSound();
    setSelectedDay(null);
    transitionTo('map', 'transition-back');
  };

  const handleTitleClick = () => {
    playClickSound();
    setSelectedDay(null);
    setViewingStepIndex(null);
    transitionTo('map', 'transition-back');
  };

  // -- Free energizer flow --
  const handleLightningClick = () => {
    playClickSound();
    setShowEnergizerPopup(true);
  };

  const handleFreeEnergizerSelect = (energizer) => {
    setShowEnergizerPopup(false);
    screenBeforeFreeEnergizer.current = screen;
    setFreeEnergizer(true);
    setFreeEnergizerData(energizer);
    transitionTo('energizer');
  };

  const handleVolumeChange = (vol) => {
    setState(prev => ({ ...prev, volume: vol }));
    setVolume(vol);
  };

  // -- Teacher panel handlers --
  const handleGoBack = () => {
    const dayId = selectedDay || state.currentDay;
    const idx = getActiveStepIndex(dayId);
    if (idx > 0) {
      const day = DAYS.find(d => d.id === dayId);
      const prev = day.steps[idx - 1];
      if (prev) {
        setState(s => {
          const nc = { ...s.completedSteps };
          delete nc[prev.id];
          return { ...s, completedSteps: nc };
        });
      }
    }
    setShowTeacherPanel(false);
  };

  const handleResetDay = () => {
    const dayId = selectedDay || state.currentDay;
    const day = DAYS.find(d => d.id === dayId);
    if (!day) return;
    setState(s => {
      const nc = { ...s.completedSteps };
      day.steps.forEach(st => delete nc[st.id]);
      return {
        ...s,
        completedSteps: nc,
        completedDays: s.completedDays.filter(id => id !== dayId),
        dayIntroSeen: { ...s.dayIntroSeen, [dayId]: false }
      };
    });
    setShowTeacherPanel(false);
  };

  const handleAddEnergy = () => {
    setState(s => ({ ...s, energy: Math.min(MAX_ENERGY, s.energy + 30) }));
    setShowTeacherPanel(false);
  };

  const handleFillEnergy = () => {
    setState(s => ({ ...s, energy: MAX_ENERGY }));
    setShowTeacherPanel(false);
  };

  const handleJumpToDay = (dayId) => {
    setState(s => ({ ...s, currentDay: Math.max(s.currentDay, dayId) }));
    setSelectedDay(dayId);
    transitionTo('day');
    setShowTeacherPanel(false);
  };

  const handleSkipStep = () => {
    const dayId = selectedDay || state.currentDay;
    const day = DAYS.find(d => d.id === dayId);
    if (!day) return;
    const idx = getActiveStepIndex(dayId);
    if (idx < day.steps.length) {
      const step = day.steps[idx];
      const newCompleted = { ...state.completedSteps, [step.id]: true };
      const newState = { ...state, completedSteps: newCompleted };

      const allDone = day.steps.every(s => newCompleted[s.id]);
      if (allDone && !state.completedDays.includes(day.id)) {
        newState.completedDays = [...state.completedDays, day.id];
        if (day.id < DAYS.length) {
          newState.currentDay = Math.max(state.currentDay, day.id + 1);
        }
      }
      setState(newState);
    }
    setShowTeacherPanel(false);
  };

  const handleSkipDay = () => {
    const dayId = selectedDay || state.currentDay;
    const day = DAYS.find(d => d.id === dayId);
    if (!day) return;
    const newCompleted = { ...state.completedSteps };
    day.steps.forEach(s => { newCompleted[s.id] = true; });
    const newState = {
      ...state,
      completedSteps: newCompleted,
      completedDays: state.completedDays.includes(dayId)
        ? state.completedDays
        : [...state.completedDays, dayId],
    };
    if (dayId < DAYS.length) {
      newState.currentDay = Math.max(state.currentDay, dayId + 1);
    }
    setState(newState);
    setShowTeacherPanel(false);
  };

  const handleResetIntro = () => {
    setState(s => ({ ...s, introCompleted: false, dayIntroSeen: {} }));
    transitionTo('splash');
    setShowTeacherPanel(false);
  };

  const handleResetAll = () => {
    const fresh = resetState();
    setState(fresh);
    setSelectedDay(null);
    setViewingStepIndex(null);
    transitionTo('splash');
    setShowTeacherPanel(false);
    audioManager.stopCurrent();
  };

  // Current computed values
  const dayData = getDayData();
  const activeStepIdx = dayData ? getActiveStepIndex(dayData.id) : 0;
  const completedDaysList = DAYS.filter(d => isDayCompleted(d.id)).map(d => d.id);
  const isIntroScreen = ['splash', 'wochenplan', 'projektregeln', 'ichStimmeZu', 'lernkarten'].includes(screen);

  return (
    <div className="no-select" style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* TopBar always visible — minimal mode on intro screens */}
      <div className="app-top-bar">
      <TopBar
        energy={state.energy}
        volume={state.volume}
        onVolumeChange={handleVolumeChange}
        dayName={null}
        dayId={null}
        dayColor={dayData?.color}
        onOpenTeacherPanel={() => setShowTeacherPanel(true)}
        onTitleClick={handleTitleClick}
        isIntro={isIntroScreen}
        onOpenBoard={!isIntroScreen ? () => setShowQuickBoard(true) : undefined}
        onOpenQuiz={!isIntroScreen ? () => setShowQuiz(true) : undefined}
        onOpenChat={!isIntroScreen ? () => setShowChat(true) : undefined}
        onOpenArtStudio={!isIntroScreen ? () => setArtStudioMode('studio') : undefined}
        onOpenArtRoom={!isIntroScreen ? () => setArtStudioMode('room') : undefined}
        onLightningClick={!isIntroScreen ? handleLightningClick : undefined}
        className={className}
        saveStatus={className ? saveStatus : null}
        projectName={project?.name}
        onDashboard={clearProject}
      />
      </div>

      {/* Screen content with fade transitions */}
      <div className="app-screen-content" style={{
        opacity: screenOpacity,
        transition: `opacity ${TRANSITION_MS}ms ease-in-out`,
        width: '100%',
        height: '100%',
      }}>
        {screen === 'splash' && <SplashScreen onStart={handleSplashStart} />}

        {screen === 'map' && (
          <MapScreen
            currentDay={state.currentDay}
            completedDays={completedDaysList}
            onDayClick={handleDayClick}
          />
        )}

        <Suspense fallback={null}>
          {screen === 'wochenplan' && <WochenplanScreen onContinue={handleWochenplanDone} />}
          {screen === 'projektregeln' && <ProjektregelnScreen onContinue={handleProjektregelnDone} />}
          {screen === 'ichStimmeZu' && <EnergizerIchStimmeZu onComplete={handleIchStimmeZuDone} />}
          {screen === 'lernkarten' && (
            <EinzelquizStepCard
              step={{ title: 'Vortest: Was wisst ihr schon?', content: { quizType: 'vortest' } }}
              dayColor="#FF6B35"
              onComplete={handleLernkartenDone}
            />
          )}

          {screen === 'dayIntro' && dayData && (
            <DayIntroScreen day={dayData} onContinue={handleDayIntroDone} />
          )}

          {screen === 'day' && dayData && (
            <DayScreen
              day={dayData}
              activeStepIndex={activeStepIdx}
              completedSteps={state.completedSteps}
              onStepClick={handleStepClick}
              onBack={handleBackToMap}
            />
          )}

          {screen === 'step' && dayData && viewingStepIndex !== null && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 1400, overflow: 'hidden' }}>
                <AnimatedBackground
                  basePath={`/images/day-backgrounds/tag${dayData.id}-background`}
                  fallbackGradient={`linear-gradient(160deg, #FFF8F0 0%, ${dayData.color}15 100%)`}
                />
              </div>
              <StepViewer
                step={dayData.steps[viewingStepIndex]}
                dayColor={dayData.color}
                onComplete={handleStepComplete}
                onBack={handleStepBack}
              />
            </>
          )}

          {screen === 'energizer' && (
            <EnergizerScreen
              usedEnergizers={state.usedEnergizers}
              dayColor={dayData?.color || '#FF6B35'}
              onComplete={handleEnergizerComplete}
              preSelected={freeEnergizerData}
            />
          )}
        </Suspense>
      </div>

      {showTeacherPanel && (
        <Suspense fallback={null}>
        <TeacherPanel
          currentDay={selectedDay || state.currentDay}
          currentStep={activeStepIdx + 1}
          energy={Math.round(state.energy)}
          onClose={() => setShowTeacherPanel(false)}
          onGoBack={handleGoBack}
          onResetDay={handleResetDay}
          onAddEnergy={handleAddEnergy}
          onFillEnergy={handleFillEnergy}
          onJumpToDay={handleJumpToDay}
          onSkipStep={handleSkipStep}
          onSkipDay={handleSkipDay}
          onResetIntro={handleResetIntro}
          onResetAll={handleResetAll}
          className={className}
          onForceSave={handleForceSave}
          lastSaveTimestamp={lastSaveTimestamp}
          onOpenWeeklyReport={() => { setShowWeeklyReport(true); setShowTeacherPanel(false); }}
        />
        </Suspense>
      )}

      {showQuickBoard && (
        <Suspense fallback={null}>
          <QuickBoardDialog
            onClose={() => setShowQuickBoard(false)}
            dayColor={dayData?.color || '#FF6B35'}
          />
        </Suspense>
      )}

      {showQuiz && (
        <Suspense fallback={null}>
          <QuizDialog
            onClose={() => setShowQuiz(false)}
            dayColor={dayData?.color || '#FF6B35'}
            className={className}
          />
        </Suspense>
      )}

      {showChat && (
        <Suspense fallback={null}>
          <ChatManager
            onClose={() => setShowChat(false)}
            dayColor={dayData?.color || '#FF6B35'}
          />
        </Suspense>
      )}

      {artStudioMode && (
        <Suspense fallback={null}>
          <ArtStudio onClose={() => setArtStudioMode(null)} initialMode={artStudioMode} />
        </Suspense>
      )}

      {showEnergizerPopup && (
        <Suspense fallback={null}>
          <EnergizerPopup
            onSelect={handleFreeEnergizerSelect}
            onClose={() => setShowEnergizerPopup(false)}
          />
        </Suspense>
      )}

      {showWeeklyReport && (
        <Suspense fallback={null}>
          <WeeklyReport
            className={className}
            onClose={() => setShowWeeklyReport(false)}
          />
        </Suspense>
      )}

      {/* Bottom logo bar — visible on map, day, dayIntro screens */}
      {['map', 'day', 'dayIntro'].includes(screen) && (
        <div className="app-bottom-bar" style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 32,
          padding: '0 24px',
          background: screen === 'map' ? 'rgba(255, 245, 235, 0.3)' : 'transparent',
          backdropFilter: screen === 'map' ? 'blur(12px)' : 'none',
          WebkitBackdropFilter: screen === 'map' ? 'blur(12px)' : 'none',
          borderTop: screen === 'map' ? '1px solid rgba(255, 166, 107, 0.12)' : 'none',
          zIndex: 90,
          boxSizing: 'border-box',
        }}>
          <img
            src="/images/ui/logo-lebenshilfe.png"
            alt="Lebenshilfe Berlin"
            loading="lazy"
            style={{ height: '70%', width: 'auto', objectFit: 'contain' }}
          />
          <img
            src="/images/ui/logo-zukunftswerkstatt.png"
            alt="LHS Zukunftswerkstatt"
            loading="lazy"
            style={{ height: '70%', width: 'auto', objectFit: 'contain' }}
          />
        </div>
      )}

      <Confetti active={showConfetti} />

      {/* Energy float animation */}
      {energyFloat && (
        <div style={{
          position: 'fixed',
          top: '40%',
          left: '50%',
          transform: 'translateX(-50%)',
          fontFamily: "'Lilita One', cursive",
          fontSize: 32,
          color: '#00C48C',
          zIndex: 9999,
          pointerEvents: 'none',
          animation: 'energyFloat 1.5s ease-out forwards',
          textShadow: '0 2px 8px rgba(0,196,140,0.3)',
        }}>
          {energyFloat}
        </div>
      )}
    </div>
  );
}
