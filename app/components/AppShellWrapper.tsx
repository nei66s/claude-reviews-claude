'use client';

import { useEffect, useState } from 'react';

/**
 * Hook para detecção de responsividade
 * Use em componentes que precisam adaptar a UI em tempo real
 */
export function useMobileDetection() {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [screenWidth, setScreenWidth] = useState(0);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setScreenWidth(width);
      setIsMobile(width < 640);
      setIsTablet(width >= 640 && width < 1024);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return {
    isMobile,
    isTablet,
    isDesktop: screenWidth >= 1024,
    screenWidth,
  };
}

/**
 * Hook legado - manter compatibilidade
 */
export function useMobileState() {
  return useMobileDetection();
}

export default useMobileDetection;
