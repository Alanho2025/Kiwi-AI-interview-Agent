import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const TourContext = createContext(null);

export const useTour = () => {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
};

export const TourProvider = ({ children }) => {
  const [runTour, setRunTour] = useState(false);
  const [tourSteps, setTourSteps] = useState([]);
  const [globalTourStep, setGlobalTourStep] = useState(null);

  // Restore global tour step from localStorage on mount
  useEffect(() => {
    const step = localStorage.getItem('kiwi_global_tour_step');
    setGlobalTourStep(step);
  }, []);

  const advanceGlobalTour = useCallback((nextStep) => {
    localStorage.setItem('kiwi_global_tour_step', nextStep);
    setGlobalTourStep(nextStep);
  }, []);

  const startGlobalTour = useCallback(() => {
    localStorage.setItem('kiwi_global_tour_step', 'home');
    setGlobalTourStep('home');
  }, []);

  const stopGlobalTour = useCallback(() => {
    localStorage.removeItem('kiwi_global_tour_step');
    setGlobalTourStep(null);
    setRunTour(false);
  }, []);

  /**
   * Start a page-level tour. We force a run=false -> run=true cycle
   * so react-joyride fully resets its internal state (including stepIndex).
   * This fixes the "Tour button does nothing on second click" bug.
   */
  const startTour = useCallback((steps) => {
    setRunTour(false);          // force reset
    setTourSteps(steps);
    setTimeout(() => setRunTour(true), 80);
  }, []);

  const stopTour = useCallback(() => {
    setRunTour(false);
  }, []);

  return (
    <TourContext.Provider value={{
      runTour, setRunTour, tourSteps,
      startTour, stopTour,
      globalTourStep, advanceGlobalTour, startGlobalTour, stopGlobalTour,
    }}>
      {children}
    </TourContext.Provider>
  );
};
