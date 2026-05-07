import React from 'react';
import { Joyride, STATUS } from 'react-joyride';
import { useTour } from '../../contexts/TourContext.jsx';

export function TourGuide() {
  const { runTour, tourSteps, setRunTour, globalTourStep, advanceGlobalTour, stopGlobalTour } = useTour();

  const handleJoyrideCallback = (data) => {
    const { status, action } = data;

    if (status === 'skipped' || action === 'close') {
      stopGlobalTour();
      setRunTour(false);
    } else if (status === 'finished') {
      setRunTour(false);
      // Advance to the next page's tour, or finish if on the last page
      const path = window.location.pathname;
      if (path === '/') advanceGlobalTour('analyze');
      else if (path.startsWith('/analyze')) advanceGlobalTour('interview');
      else if (path.startsWith('/interview')) advanceGlobalTour('report');
      else if (path.startsWith('/report')) stopGlobalTour();
    }
  };

  if (!tourSteps.length) return null;

  return (
    <Joyride
      callback={handleJoyrideCallback}
      continuous
      run={runTour}
      scrollToFirstStep
      showProgress
      showSkipButton
      steps={tourSteps}
      disableOverlayClose={false}
      styles={{
        options: {
          zIndex: 10000,
          primaryColor: '#10b981',
          textColor: '#374151',
          backgroundColor: '#ffffff',
          overlayColor: 'rgba(0, 0, 0, 0.5)',
        },
        tooltipContainer: {
          textAlign: 'left',
        },
        buttonNext: {
          backgroundColor: '#10b981',
        },
        buttonBack: {
          marginRight: 10,
        },
      }}
      locale={{
        last: globalTourStep === 'report' ? 'Finish Tour 🎉' : 'Next Page →',
        skip: 'Skip Tour',
      }}
    />
  );
}
