import { motion } from 'framer-motion';
import { ScrollText, Code2, Heart } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const LICENSE_TEXT = `MIT License

Copyright (c) 2026 Aditya Rhayakar

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

const TECH_STACK = ['React', 'TypeScript', 'Tailwind CSS', 'Framer Motion', 'Vite', 'shadcn/ui', 'Lucide Icons'];

const License = () => (
  <div className="min-h-screen bg-background pb-20">
    <header className="border-b border-border">
      <div className="max-w-xl mx-auto px-4 py-4 flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center glow-primary">
          <ScrollText className="w-5 h-5 text-primary" />
        </div>
        <h1 className="text-lg font-bold tracking-tight">About</h1>
      </div>
    </header>

    <main className="max-w-xl mx-auto px-4 py-6 space-y-6">
      {/* App Info */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="surface-elevated rounded-xl p-6 text-center space-y-2">
        <h2 className="text-2xl font-bold glow-text-primary">Taskal</h2>
        <p className="text-sm text-muted-foreground">v1.0.0</p>
        <p className="text-sm text-muted-foreground">Schedule. Focus. Level up.</p>
        <p className="text-xs text-muted-foreground mt-2">A gamified focus planner that helps you stay productive through timed sessions, points, and streaks.</p>
      </motion.div>

      {/* Tech Stack */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <Code2 className="w-4 h-4" /> Technology Stack
        </h2>
        <div className="flex flex-wrap gap-2">
          {TECH_STACK.map(t => (
            <Badge key={t} variant="secondary" className="font-mono text-xs">{t}</Badge>
          ))}
        </div>
      </motion.div>

      {/* License */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">License</h2>
        <div className="surface-elevated rounded-xl p-4">
          <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">{LICENSE_TEXT}</pre>
        </div>
      </motion.div>

      {/* Credits */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1">
        Built with <Heart className="w-3 h-3 text-destructive" /> using Lovable
      </motion.div>
    </main>
  </div>
);

export default License;
