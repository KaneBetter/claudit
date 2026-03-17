import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { TerminalSquare } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getTerminalTheme } from '../../lib/terminalThemes';
import { useResolvedTheme } from '../../hooks/useThemeEffect';
import '@xterm/xterm/css/xterm.css';

const CTRL_PREFIX = '\x00';

export default function TerminalPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'exited' | 'error'>('connecting');
  const [termReady, setTermReady] = useState(false);
  const resolvedTheme = useResolvedTheme();

  // Update terminal theme when resolved theme changes
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = getTerminalTheme(resolvedTheme);
    }
  }, [resolvedTheme]);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: getTerminalTheme(resolvedTheme),
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    term.open(containerRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Connect WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/terminal`);
    wsRef.current = ws;

    ws.onopen = () => {
      const dims = fitAddon.proposeDimensions();
      ws.send(JSON.stringify({
        type: 'shell',
        cols: dims?.cols || 80,
        rows: dims?.rows || 24,
      }));
    };

    ws.onmessage = (event) => {
      const data = event.data as string;

      if (data.startsWith(CTRL_PREFIX)) {
        const ctrl = JSON.parse(data.slice(1));
        switch (ctrl.type) {
          case 'ready':
            setStatus('connected');
            setTimeout(() => {
              fitAddonRef.current?.fit();
              termRef.current?.scrollToBottom();
              setTermReady(true);
            }, 50);
            break;
          case 'scrollback-end':
            fitAddonRef.current?.fit();
            termRef.current?.scrollToBottom();
            break;
          case 'exit':
            setStatus('exited');
            term.writeln('');
            term.writeln('\x1b[90m--- Shell exited (code: ' + ctrl.exitCode + ') ---\x1b[0m');
            setTermReady(true);
            break;
          case 'error':
            setStatus('error');
            term.writeln('\x1b[31mError: ' + ctrl.message + '\x1b[0m');
            setTermReady(true);
            break;
        }
        return;
      }

      term.write(data);
    };

    ws.onerror = () => {
      if (wsRef.current !== ws) return;
      setStatus('error');
      setTermReady(true);
      term.writeln('\x1b[31mWebSocket connection error\x1b[0m');
    };

    ws.onclose = () => {
      if (wsRef.current !== ws) return;
      setStatus('exited');
    };

    const inputDisposable = term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    });

    let resizeTimer: ReturnType<typeof setTimeout>;
    const observer = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (!fitAddonRef.current || !termRef.current) return;
        fitAddonRef.current.fit();
        const dims = fitAddonRef.current.proposeDimensions();
        if (dims && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'resize',
            cols: dims.cols,
            rows: dims.rows,
          }));
        }
      }, 100);
    });
    observer.observe(containerRef.current);

    return () => {
      clearTimeout(resizeTimer);
      observer.disconnect();
      inputDisposable.dispose();
      ws.close();
      wsRef.current = null;
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
      setStatus('connecting');
      setTermReady(false);
    };
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/30 bg-card/30 shrink-0">
        <TerminalSquare className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium text-foreground">Terminal</span>
        <div className={cn(
          'w-1.5 h-1.5 rounded-full ml-1',
          status === 'connected' ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]' :
          status === 'connecting' ? 'bg-amber-400 animate-pulse' :
          status === 'error' ? 'bg-destructive' :
          'bg-muted-foreground/30'
        )} />
        <span className="text-[10px] text-muted-foreground">
          {status === 'connecting' ? 'Connecting...' :
           status === 'connected' ? 'Connected' :
           status === 'error' ? 'Error' :
           'Exited'}
        </span>
      </div>

      {/* Terminal */}
      <div className="flex-1 min-h-0" style={{ padding: '8px 10px' }}>
        <div
          ref={containerRef}
          className="h-full w-full"
          style={{ visibility: termReady ? 'visible' : 'hidden' }}
        />
      </div>
    </div>
  );
}
