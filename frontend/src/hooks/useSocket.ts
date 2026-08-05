import { useEffect, useRef } from "react";
import { getSocket } from "../lib/socket";

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
