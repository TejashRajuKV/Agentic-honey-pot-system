import { useEffect, useState } from "react";
import { getSystemStatus } from "../api/api";

/** Polls /api/v1/system/status. `status` is null until the first response; `error` when the gateway is unreachable. */
export default function useSystemStatus(intervalMs = 15000) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    const poll = () =>
      getSystemStatus()
        .then((s) => { if (alive) { setStatus(s); setError(false); } })
        .catch(() => { if (alive) setError(true); });
    poll();
    const t = setInterval(poll, intervalMs);
    return () => { alive = false; clearInterval(t); };
  }, [intervalMs]);

  return { status, error };
}
