import React, { useState, useCallback, useEffect, useRef } from 'react';
import { DAYS } from '../data/days';
import { loadState, saveState, resetState } from '../utils/persistence';
import { setVolume, playClickSound, playSuccessSound, playCompleteSound } from '../utils/audio';
import { audioManager } from '../utils/audioManager';
import { LOW_ENERGY_THRESHOLD, MAX_ENERGY, CLASS_STORAGE_KEY } from '../utils/constants';
import { subscribeToClass, saveClassState, setIsRemoteUpdate } from '../utils/firebasePersistence';

import AnimatedBackground from './AnimatedBackground';
import ClassSetupScreen from './ClassSetupScreen';
import SplashScreen from './SplashScreen';
import WochenplanScreen from './WochenplanScreen';
import ProjektregelnScreen from './ProjektregelnScreen';
import EnergizerIchStimmeZu from './EnergizerIchStimmeZu';
import LernkartenGame from './LernkartenGame';
import MapScreen from './MapScreen';
import DayScreen from './DayScreen';
import DayIntroScreen from './DayIntroScreen';
import StepViewer from './StepViewer';
import EnergizerScreen from './EnergizerScreen';
import TeacherPanel from './TeacherPanel';
import TopBar from './TopBar';
import QuickBoardDialog from './QuickBoardDialog';
import Confetti from './Confetti';

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

  // F4: Class system
  const [className, setClassName] = useState(() => {
    try { return localStorage.getItem(CLASS_STORAGE_KEY) || null; } catch { return null; }
  });
  const isRemoteUpdateRef = useRef(false);

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

  // Persist on every state change (localStorage always as fallback)
  useEffect(() => { saveState(state); }, [state]);
  useEffect(() => { setVolume(state.volume); }, [state.volume]);

  // F4: Firebase sync — subscribe to class state
  useEffect(() => {
    if (!className) return;
    const unsub = subscribeToClass(className, (remoteState) => {
      if (remoteState === null) {
        // New class — no data in Firebase yet. Keep current (default) state.
        // The save effect will write it to Firebase shortly.
        return;
      }
      try {
        isRemoteUpdateRef.current = true;
        setIsRemoteUpdate(true);
        setState(prev => ({
          ...remoteState,
          volume: prev.volume,
          // Ensure arrays survive Firebase round-trip
          completedDays: Array.isArray(remoteState.completedDays) ? remoteState.completedDays : [],
          usedEnergizers: Array.isArray(remoteState.usedEnergizers) ? remoteState.usedEnergizers : [],
          completedSteps: (remoteState.completedSteps && typeof remoteState.completedSteps === 'object') ? remoteState.completedSteps : {},
          dayIntroSeen: (remoteState.dayIntroSeen && typeof remoteState.dayIntroSeen === 'object') ? remoteState.dayIntroSeen : {},
        }));
      } catch (err) {
        console.error('[App] Error applying remote state:', err);
      }
      // Reset flag after React processes the update
      setTimeout(() => {
        isRemoteUpdateRef.current = false;
        setIsRemoteUpdate(false);
      }, 100);
    });
    return () => unsub();
  }, [className]);

  // F4: Firebase sync — save state to Firebase on changes
  useEffect(() => {
    if (!className) return;
    if (isRemoteUpdateRef.current) return;
    try {
      saveClassState(className, state);
    } catch (err) {
      console.error('[App] Error saving to Firebase:', err);
    }
  }, [state, className]);

  // Pre-init audioManager on mount (async, no user gesture needed)
  useEffect(() => {
    audioManager.init();
  }, []);

  // Start music on first user interaction anywhere on the page
  useEffect(() => {
    let started = false;
    const startMusic = (e) => {
      console.log('App: first interaction detected:', e.type, 'started:', started);
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
    setViewingStepIndex(null);
    transitionTo('day');
  };

  const handleStepBack = () => {
    playClickSound();
    setViewingStepIndex(null);
    transitionTo('day', 'transition-back');
  };

  const handleEnergizerComplete = (energizer) => {
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
        setState(prev => ({
          ...prev,
          energy: Math.max(0, Math.min(MAX_ENERGY, prev.energy + reward) - step.energyCost),
          usedEnergizers: [...prev.usedEnergizers, energizer.id]
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

  // F4: Class handlers
  const handleClassSelected = (name) => {
    // Reset to fresh default state first — Firebase subscription will overwrite
    // if this class already has saved progress
    const fresh = resetState();
    setState(prev => ({ ...fresh, volume: prev.volume }));
    setSelectedDay(null);
    setViewingStepIndex(null);
    setScreen('splash');
    localStorage.setItem(CLASS_STORAGE_KEY, name);
    setClassName(name);
  };

  const handleSwitchClass = () => {
    localStorage.removeItem(CLASS_STORAGE_KEY);
    setClassName(null);
    setShowTeacherPanel(false);
  };

  const handleNewClass = () => {
    localStorage.removeItem(CLASS_STORAGE_KEY);
    const fresh = resetState();
    setState(fresh);
    setClassName(null);
    setSelectedDay(null);
    setViewingStepIndex(null);
    setScreen('splash');
    setShowTeacherPanel(false);
  };

  const handleResetClass = () => {
    if (!className) return;
    const fresh = resetState();
    setState(fresh);
    setSelectedDay(null);
    setViewingStepIndex(null);
    setScreen('splash');
    setShowTeacherPanel(false);
  };

  // Current computed values
  const dayData = getDayData();
  const activeStepIdx = dayData ? getActiveStepIndex(dayData.id) : 0;
  const completedDaysList = DAYS.filter(d => isDayCompleted(d.id)).map(d => d.id);
  const isIntroScreen = ['splash', 'wochenplan', 'projektregeln', 'ichStimmeZu', 'lernkarten'].includes(screen);

  // F4: Show class setup if no class selected
  if (!className) {
    return <ClassSetupScreen onClassSelected={handleClassSelected} />;
  }

  return (
    <div className="no-select" style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* TopBar always visible — minimal mode on intro screens */}
      <TopBar
        energy={state.energy}
        volume={state.volume}
        onVolumeChange={handleVolumeChange}
        dayName={dayData && !isIntroScreen && screen !== 'map' ? `${dayData.emoji} ${dayData.name}` : null}
        dayId={dayData && !isIntroScreen && screen !== 'map' ? dayData.id : null}
        dayColor={dayData?.color}
        onOpenTeacherPanel={() => setShowTeacherPanel(true)}
        onTitleClick={handleTitleClick}
        isIntro={isIntroScreen}
        onOpenBoard={!isIntroScreen ? () => setShowQuickBoard(true) : undefined}
        className={className}
      />

      {/* Screen content with fade transitions */}
      <div style={{
        opacity: screenOpacity,
        transition: `opacity ${TRANSITION_MS}ms ease-in-out`,
        width: '100%',
        height: '100%',
      }}>
        {screen === 'splash' && <SplashScreen onStart={handleSplashStart} />}
        {screen === 'wochenplan' && <WochenplanScreen onContinue={handleWochenplanDone} />}
        {screen === 'projektregeln' && <ProjektregelnScreen onContinue={handleProjektregelnDone} />}
        {screen === 'ichStimmeZu' && <EnergizerIchStimmeZu onComplete={handleIchStimmeZuDone} />}
        {screen === 'lernkarten' && <LernkartenGame onComplete={handleLernkartenDone} />}

        {screen === 'map' && (
          <MapScreen
            currentDay={state.currentDay}
            completedDays={completedDaysList}
            onDayClick={handleDayClick}
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
          />
        )}
      </div>

      {showTeacherPanel && (
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
          onSwitchClass={handleSwitchClass}
          onNewClass={handleNewClass}
          onResetClass={handleResetClass}
        />
      )}

      {showQuickBoard && (
        <QuickBoardDialog
          onClose={() => setShowQuickBoard(false)}
          dayColor={dayData?.color || '#FF6B35'}
        />
      )}

      {/* Bottom logo bar — visible on map, day, dayIntro screens */}
      {['map', 'day', 'dayIntro'].includes(screen) && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          background: 'rgba(255, 245, 235, 0.3)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(255, 166, 107, 0.12)',
          zIndex: 90,
          boxSizing: 'border-box',
        }}>
          <img
            src="/images/ui/logo-lebenshilfe.png"
            alt="Lebenshilfe Berlin"
            style={{ height: '70%', width: 'auto', objectFit: 'contain' }}
          />
          <img
            src="/images/ui/logo-zukunftswerkstatt.png"
            alt="LHS Zukunftswerkstatt"
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
