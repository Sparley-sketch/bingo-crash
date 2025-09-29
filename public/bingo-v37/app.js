function useInterval(cb, delay) {
  const ref = useRef(cb);
  useEffect(() => { ref.current = cb; }, [cb]);
  useEffect(() => {
    if (delay == null) return;
    const id = setInterval(() => ref.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

// Read ?round_ms= from the page URL, fallback to 800ms
function getRoundMsFromQuery(defaultMs = 800) {
  try {
    const ms = Number(new URLSearchParams(window.location.search).get('round_ms'));
    if (Number.isFinite(ms) && ms >= 100 && ms <= 5000) return ms;
  } catch {}
  return defaultMs;
}
