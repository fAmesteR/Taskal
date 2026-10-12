import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DatePickerStripProps {
  selectedDate: string;
  onSelect: (date: string) => void;
}

function getDaysList(center: string) {
  const centerDate = new Date(center + 'T12:00:00');
  const days: Date[] = [];
  for (let i = -3; i <= 3; i++) {
    const d = new Date(centerDate);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

function formatDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function DatePickerStrip({ selectedDate, onSelect }: DatePickerStripProps) {
  const days = getDaysList(selectedDate);
  const today = new Date().toISOString().slice(0, 10);

  const shift = (dir: number) => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + dir);
    onSelect(formatDateStr(d));
  };

  return (
    <div className="flex items-center gap-1">
      <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => shift(-1)}>
        <ChevronLeft className="w-4 h-4" />
      </Button>
      <div className="flex gap-1 flex-1 justify-center overflow-hidden">
        {days.map(d => {
          const ds = formatDateStr(d);
          const isSelected = ds === selectedDate;
          const isToday = ds === today;
          return (
            <motion.button
              key={ds}
              whileTap={{ scale: 0.95 }}
              onClick={() => onSelect(ds)}
              className={`flex flex-col items-center py-2 px-3 rounded-lg transition-all text-xs
                ${isSelected
                  ? 'bg-primary text-primary-foreground glow-primary'
                  : 'hover:bg-secondary text-muted-foreground hover:text-foreground'
                }
                ${isToday && !isSelected ? 'border border-primary/30' : ''}
              `}
            >
              <span className="text-[10px] uppercase tracking-wider">{dayNames[d.getDay()]}</span>
              <span className="font-mono font-bold text-base">{d.getDate()}</span>
            </motion.button>
          );
        })}
      </div>
      <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => shift(1)}>
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
}
