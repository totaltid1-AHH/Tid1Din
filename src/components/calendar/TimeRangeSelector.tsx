import React, { useState, useEffect } from 'react';
import { Clock, ChevronDown, Edit3, Check, AlertCircle } from 'lucide-react';
import {
  generateTimeOptions,
  isValidTimeString,
  sanitizeTimeInput,
  formatTimeOnBlur,
  calculateEndTime
} from '../../utils/calendar';

interface TimeRangeSelectorProps {
  startTime: string;
  endTime: string;
  onStartTimeChange: (newStart: string) => void;
  onEndTimeChange: (newEnd: string) => void;
  durationMinutes: number;
  className?: string;
}

export const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({
  startTime,
  endTime,
  onStartTimeChange,
  onEndTimeChange,
  durationMinutes,
  className = ''
}) => {
  const [isManualMode, setIsManualMode] = useState(false);
  const [localStart, setLocalStart] = useState(startTime);
  const [localEnd, setLocalEnd] = useState(endTime);

  // Hold lokale verdier synkronisert når props oppdateres utenfra (f.eks. forhåndsvalg)
  useEffect(() => {
    setLocalStart(startTime);
  }, [startTime]);

  useEffect(() => {
    setLocalEnd(endTime);
  }, [endTime]);

  const timeOptions = generateTimeOptions([startTime, endTime]);

  const isStartValid = isValidTimeString(localStart);
  const isEndValid = isValidTimeString(localEnd);
  const hasFormatError = (localStart.length > 0 && !isStartValid) || (localEnd.length > 0 && !isEndValid);
  const isEndBeforeOrEqualStart = isStartValid && isEndValid && localEnd <= localStart;

  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sanitized = sanitizeTimeInput(e.target.value, localStart);
    setLocalStart(sanitized);
    if (isValidTimeString(sanitized)) {
      onStartTimeChange(sanitized);
    }
  };

  const handleStartBlur = () => {
    const formatted = formatTimeOnBlur(localStart, startTime);
    setLocalStart(formatted);
    if (formatted !== startTime) {
      onStartTimeChange(formatted);
    }
  };

  const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sanitized = sanitizeTimeInput(e.target.value, localEnd);
    setLocalEnd(sanitized);
    if (isValidTimeString(sanitized)) {
      onEndTimeChange(sanitized);
    }
  };

  const handleEndBlur = () => {
    const formatted = formatTimeOnBlur(localEnd, endTime);
    setLocalEnd(formatted);
    if (formatted !== endTime) {
      onEndTimeChange(formatted);
    }
  };

  const handleToggleMode = () => {
    if (isManualMode) {
      // Sikre gyldige verdier før tilbakegang til liste
      const fStart = formatTimeOnBlur(localStart, startTime);
      const fEnd = formatTimeOnBlur(localEnd, endTime);
      setLocalStart(fStart);
      setLocalEnd(fEnd);
      if (fStart !== startTime) onStartTimeChange(fStart);
      if (fEnd !== endTime) onEndTimeChange(fEnd);
    }
    setIsManualMode(!isManualMode);
  };

  return (
    <div className={`bg-slate-50/90 rounded-2xl p-3 border border-slate-200/90 space-y-2.5 ${className}`}>
      {/* Topplinje med tittel, varighet og modus-veksler */}
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-sky-600" />
          <span>Tidspunkt</span>
        </span>

        <div className="flex items-center gap-2">
          {durationMinutes > 0 && isStartValid && isEndValid ? (
            <span className="text-[11px] font-semibold text-slate-600 font-mono bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs">
              {durationMinutes} min
            </span>
          ) : (
            <span className="text-[11px] font-bold text-rose-700 font-mono bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 shadow-2xs">
              Ugyldig tid
            </span>
          )}

          <button
            type="button"
            onClick={handleToggleMode}
            title={isManualMode ? 'Bruk tidsliste' : 'Tast inn klokkeslett manuelt'}
            className="text-[10px] font-bold text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 px-1.5 py-0.5 rounded border border-sky-200 transition-colors flex items-center gap-1 cursor-pointer"
          >
            {isManualMode ? (
              <>
                <Check className="w-3 h-3 text-emerald-600" />
                <span>Velg fra liste</span>
              </>
            ) : (
              <>
                <Edit3 className="w-3 h-3 text-sky-600" />
                <span>Tast inn</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* To separate kort for Starttid og Sluttid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 items-stretch">
        
        {/* STARTTID KORT */}
        <div
          className={`bg-white rounded-xl border p-2 sm:p-2.5 shadow-2xs transition-all min-w-0 ${
            isManualMode && localStart.length > 0 && !isStartValid
              ? 'border-rose-300 bg-rose-50/20 focus-within:border-rose-500 focus-within:ring-2 focus-within:ring-rose-500/20'
              : 'border-slate-300 focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/20'
          }`}
        >
          <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-0.5 truncate">
            Starttid
          </span>
          {isManualMode ? (
            <input
              type="text"
              inputMode="numeric"
              maxLength={5}
              placeholder="10:00"
              value={localStart}
              onChange={handleStartChange}
              onBlur={handleStartBlur}
              className="w-full bg-transparent font-mono text-base font-extrabold text-slate-900 focus:outline-none text-center py-0.5"
            />
          ) : (
            <div className="relative flex items-center">
              <select
                value={startTime}
                onChange={(e) => onStartTimeChange(e.target.value)}
                className="w-full bg-transparent font-mono text-base font-extrabold text-slate-900 focus:outline-none cursor-pointer appearance-none pr-5 py-0.5 text-center"
              >
                {timeOptions.map((t) => (
                  <option key={`start-${t}`} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-0 pointer-events-none" />
            </div>
          )}
        </div>

        {/* SLUTTID KORT */}
        <div
          className={`bg-white rounded-xl border p-2 sm:p-2.5 shadow-2xs transition-all min-w-0 ${
            isManualMode && localEnd.length > 0 && !isEndValid
              ? 'border-rose-300 bg-rose-50/20 focus-within:border-rose-500 focus-within:ring-2 focus-within:ring-rose-500/20'
              : 'border-slate-300 focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/20'
          }`}
        >
          <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-0.5 truncate">
            Sluttid
          </span>
          {isManualMode ? (
            <input
              type="text"
              inputMode="numeric"
              maxLength={5}
              placeholder="10:45"
              value={localEnd}
              onChange={handleEndChange}
              onBlur={handleEndBlur}
              className="w-full bg-transparent font-mono text-base font-extrabold text-slate-900 focus:outline-none text-center py-0.5"
            />
          ) : (
            <div className="relative flex items-center">
              <select
                value={endTime}
                onChange={(e) => onEndTimeChange(e.target.value)}
                className="w-full bg-transparent font-mono text-base font-extrabold text-slate-900 focus:outline-none cursor-pointer appearance-none pr-5 py-0.5 text-center"
              >
                {timeOptions.map((t) => (
                  <option key={`end-${t}`} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-0 pointer-events-none" />
            </div>
          )}
        </div>

      </div>

      {/* Advarsler ved feil i manuell modus */}
      {isManualMode && hasFormatError && (
        <div className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
          <span>Ugyldig klokkeslett (timer 00–23, minutter 00–59).</span>
        </div>
      )}

      {isManualMode && !hasFormatError && isEndBeforeOrEqualStart && (
        <div className="flex items-center justify-between p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
          <span>Sluttid må være etter starttid.</span>
          <button
            type="button"
            onClick={() => {
              const newEnd = calculateEndTime(localStart, 0.75);
              setLocalEnd(newEnd);
              onEndTimeChange(newEnd);
            }}
            className="px-2 py-0.5 rounded bg-amber-200 hover:bg-amber-300 text-amber-950 font-bold text-[10px] cursor-pointer"
          >
            Sett til +45 min
          </button>
        </div>
      )}
    </div>
  );
};
