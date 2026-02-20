import { createContext, useContext, useState, useCallback, useRef } from 'react';

const UIContext = createContext(null);

export function UIProvider({ children }) {
  const [showCalendarToast, setShowCalendarToast] = useState(false);
  const [calendarToastMessage, setCalendarToastMessage] = useState('');
  const [calendarToastType, setCalendarToastType] = useState('info');
  const toastTimeoutRef = useRef(null);

  const showToast = useCallback((message, type = 'info', duration = 3000) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setCalendarToastMessage(message);
    setCalendarToastType(type);
    setShowCalendarToast(true);
    toastTimeoutRef.current = setTimeout(() => setShowCalendarToast(false), duration);
  }, []);

  return (
    <UIContext.Provider value={{
      showCalendarToast, setShowCalendarToast,
      calendarToastMessage, setCalendarToastMessage,
      calendarToastType, setCalendarToastType,
      showToast,
    }}>
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used within UIProvider');
  return ctx;
}
