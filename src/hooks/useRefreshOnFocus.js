import { useEffect } from "react";

/**
 * Custom hook to automatically trigger a silent refresh function
 * whenever the user brings the browser tab or window back into focus.
 */
export function useRefreshOnFocus(refreshCallback) {
  useEffect(() => {
    const handleFocus = () => {
      if (document.visibilityState === "visible") {
        refreshCallback();
      }
    };

    // Listen for tab visibility switching
    document.addEventListener("visibilitychange", handleFocus);
    // Listen for window/OS focus switching
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleFocus);
      window.removeEventListener("focus", handleFocus);
    };
  }, [refreshCallback]);
}