import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

let socket;

export function useSocket(userId) {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    if (!userId) return;

    socket = io('http://localhost:5000');
    socket.emit('join', userId);

    const onDataUploaded = (payload) => {
      setEvents((prev) => [{ type: 'data_uploaded', payload, time: Date.now() }, ...prev].slice(0, 10));
    };

    const onAlertsUpdated = (payload) => {
      setEvents((prev) => [{ type: 'alerts_updated', payload, time: Date.now() }, ...prev].slice(0, 10));
    };

    socket.on('data_uploaded', onDataUploaded);
    socket.on('alerts_updated', onAlertsUpdated);

    return () => {
      socket.off('data_uploaded', onDataUploaded);
      socket.off('alerts_updated', onAlertsUpdated);
      socket.disconnect();
    };
  }, [userId]);

  return events;
}
