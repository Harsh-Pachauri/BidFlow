import { useEffect, useRef } from "react";
import { getSocket } from "../lib/socket";

// Joins a room on mount, leaves it on unmount. `payload` should be a stable
// value (e.g. a primitive rfqId) -- it's compared by JSON string so callers
// don't need to memoize an object themselves.
export function useSocketRoom(joinEvent: string, leaveEvent: string, payload?: Record<string, unknown>) {
  const payloadKey = JSON.stringify(payload ?? {});

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.emit(joinEvent, payload);
    return () => {
      socket.emit(leaveEvent, payload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinEvent, leaveEvent, payloadKey]);
}

// Subscribes to a socket event for the component's lifetime. The handler is
// kept in a ref so the subscription itself doesn't churn just because the
// caller passed a new function reference on every render.
export function useSocketEvent<T>(event: string, handler: (payload: T) => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const listener = (payload: T) => handlerRef.current(payload);
    socket.on(event, listener);
    return () => {
      socket.off(event, listener);
    };
  }, [event]);
}
