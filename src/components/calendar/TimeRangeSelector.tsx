import React, { useState } from 'react';
import { Clock, ChevronDown, Edit3, Check } from 'lucide-react';
import { generateTimeOptions } from '../../utils/calendar';

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
  const timeOptions = generateTimeOptions([startTime, endTime]);

  return (
    <div className={`bg-slate-50/90 rounded-2xl p-3 border border-slate-200/90 space-y-2.5 ${className}`}>
      {/* Topplinje med tittel, varighet og modus-veksler */}
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-sky-600" />
          <span>Tidspunkt</span>
        </span>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-600 font-mono bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs">
            {durationMinutes > 0 ? `${durationMinutes} min` : '0 min'}
          </span>
          <button
            type="button"
            onClick={() => setIsManualMode(!isManualMode)}
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

      {/* To separate kort for Starttid og Sluttid - garantert ingen overlapp på iPad eller mobil */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 items-stretch">
        
        {/* STARTTID KORT */}
        <div className="bg-white rounded-xl border border-slate-300 p-2 sm:p-2.5 shadow-2xs focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/20 transition-all min-w-0">
          <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-0.5 truncate">
            Starttid
          </span>
          {isManualMode ? (
            <input
              type="text"
              inputMode="numeric"
              maxLength={5}
              placeholder="10:00"
              value={startTime}
              onChange={(e) => onStartTimeChange(e.target.value)}
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
        <div className="bg-white rounded-xl border border-slate-300 p-2 sm:p-2.5 shadow-2xs focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/20 transition-all min-w-0">
          <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-0.5 truncate">
            Sluttid
          </span>
          {isManualMode ? (
            <input
              type="text"
              inputMode="numeric"
              maxLength={5}
              placeholder="10:45"
              value={endTime}
              onChange={(e) => onEndTimeChange(e.target.value)}
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
    </div>
  );
};
