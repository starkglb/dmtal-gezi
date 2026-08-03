'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

const ALARM_URL = '/sounds/emergency-alarm.mp3';

export interface AlarmController {
  isPlaying: boolean;
  audioEnabled: boolean;
  startAlarm: () => void;
  stopAlarm: () => void;
  enableAudio: () => Promise<void>;
  showManualStart: boolean;
}

export function useEmergencyAlarm(): AlarmController {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [showManualStart, setShowManualStart] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const audio = new Audio(ALARM_URL);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.7;
    audioRef.current = audio;

    const stored = localStorage.getItem('emergency_alarm_enabled');
    if (stored === 'true') {
      setAudioEnabled(true);
    }

    const handleEnded = () => setIsPlaying(false);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('ended', handleEnded);
      audioRef.current = null;
    };
  }, []);

  const enableAudio = useCallback(async () => {
    if (!audioRef.current) return;
    try {
      audioRef.current.muted = true;
      await audioRef.current.play();
      audioRef.current.pause();
      audioRef.current.muted = false;
      audioRef.current.currentTime = 0;
      setAudioEnabled(true);
      localStorage.setItem('emergency_alarm_enabled', 'true');
    } catch {
      setAudioEnabled(true);
      localStorage.setItem('emergency_alarm_enabled', 'true');
    }
  }, []);

  const startAlarm = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play()
      .then(() => {
        setIsPlaying(true);
        setShowManualStart(false);
      })
      .catch(() => {
        setShowManualStart(true);
        setIsPlaying(false);
      });
  }, []);

  const stopAlarm = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setIsPlaying(false);
  }, []);

  return {
    isPlaying,
    audioEnabled,
    startAlarm,
    stopAlarm,
    enableAudio,
    showManualStart,
  };
}
