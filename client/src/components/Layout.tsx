import { ReactNode, useState, useCallback, useEffect, useRef, createContext, useContext } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useUIStore } from '../stores/useUIStore';

const SIDEBAR_STORAGE_KEY = 'claudit:sidebar-width';
const SIDEBAR_MIN = 220;
const SIDEBAR_MAX = 500;
const SIDEBAR_DEFAULT = 300;

const NAV_STORAGE_KEY = 'claudit:nav-width';
const NAV_MIN = 56;
const NAV_MAX = 180;
const NAV_DEFAULT = 56;
const NAV_COLLAPSE_THRESHOLD = 80;

const MOBILE_BREAKPOINT = 768;

function loadWidth(key: string, min: number, max: number, fallback: number): number {
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      const n = Number(saved);
      if (n >= min && n <= max) return n;
    }
  } catch {}
  return fallback;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < MOBILE_BREAKPOINT);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

interface Props {
  nav: ReactNode;
  sidebar: ReactNode;
  main: ReactNode;
}

export default function Layout({ nav, sidebar, main }: Props) {
  const hasSidebar = sidebar != null;
  const isMobile = useIsMobile();
  const sidebarCollapsed = useUIStore(s => s.sidebarCollapsed);
  const toggleSidebar = useUIStore(s => s.toggleSidebar);
  const setSidebarCollapsed = useUIStore(s => s.setSidebarCollapsed);

  // Auto-collapse sidebar on mobile
  useEffect(() => {
    if (isMobile && !sidebarCollapsed) {
      setSidebarCollapsed(true);
    }
  }, [isMobile]);

  const [sidebarWidth, setSidebarWidth] = useState(() =>
    loadWidth(SIDEBAR_STORAGE_KEY, SIDEBAR_MIN, SIDEBAR_MAX, SIDEBAR_DEFAULT)
  );
  const sidebarDragging = useRef(false);
  const sidebarWidthRef = useRef(sidebarWidth);
  sidebarWidthRef.current = sidebarWidth;

  const [navWidth, setNavWidth] = useState(() =>
    loadWidth(NAV_STORAGE_KEY, NAV_MIN, NAV_MAX, NAV_DEFAULT)
  );
  const navDragging = useRef(false);
  const navWidthRef = useRef(navWidth);
  navWidthRef.current = navWidth;

  const collapsed = isMobile || navWidth < NAV_COLLAPSE_THRESHOLD;

  const onSidebarMouseDown = useCallback((e: React.MouseEvent) => {
    if (isMobile) return;
    e.preventDefault();
    sidebarDragging.current = true;
    document.body.classList.add('select-none');
  }, [isMobile]);

  const onNavMouseDown = useCallback((e: React.MouseEvent) => {
    if (isMobile) return;
    e.preventDefault();
    navDragging.current = true;
    document.body.classList.add('select-none');
  }, [isMobile]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (navDragging.current) {
        const newWidth = Math.min(NAV_MAX, Math.max(NAV_MIN, e.clientX));
        setNavWidth(newWidth);
        navWidthRef.current = newWidth;
      }
      if (sidebarDragging.current) {
        const offset = navWidthRef.current;
        const newWidth = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, e.clientX - offset));
        setSidebarWidth(newWidth);
        sidebarWidthRef.current = newWidth;
      }
    };
    const onMouseUp = () => {
      if (navDragging.current) {
        navDragging.current = false;
        document.body.classList.remove('select-none');
        try { localStorage.setItem(NAV_STORAGE_KEY, String(navWidthRef.current)); } catch {}
      }
      if (sidebarDragging.current) {
        sidebarDragging.current = false;
        document.body.classList.remove('select-none');
        try { localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarWidthRef.current)); } catch {}
      }
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (navDragging.current || sidebarDragging.current) {
        document.body.classList.remove('select-none');
      }
    };
  }, []);

  // Close mobile drawer on backdrop click
  const onBackdropClick = useCallback(() => {
    if (isMobile && !sidebarCollapsed) {
      setSidebarCollapsed(true);
    }
  }, [isMobile, sidebarCollapsed, setSidebarCollapsed]);

  /* ── Mobile layout ── */
  if (isMobile) {
    return (
      <div className="h-screen flex flex-col bg-background relative overflow-hidden">
        {/* Mobile header */}
        <header className="flex items-center h-12 px-3 border-b border-border/40 flex-shrink-0 z-20 bg-background">
          {hasSidebar && (
            <button
              onClick={toggleSidebar}
              className="p-2 -ml-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              aria-label={sidebarCollapsed ? 'Open sidebar' : 'Close sidebar'}
            >
              {sidebarCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
            </button>
          )}
          <div className="flex items-center gap-2 ml-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-claude to-orange-400 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-xs">C</span>
            </div>
            <span className="font-semibold text-foreground text-sm">Claudit</span>
          </div>
        </header>

        {/* Mobile body */}
        <div className="flex-1 flex relative min-h-0">
          {/* Mobile drawer overlay */}
          {hasSidebar && !sidebarCollapsed && (
            <div className="absolute inset-0 bg-black/20 z-30" onClick={onBackdropClick} />
          )}

          {/* Mobile sidebar drawer */}
          {hasSidebar && (
            <aside
              className="absolute top-0 left-0 bottom-0 z-40 bg-background border-r border-border/40 transition-transform duration-200 ease-out overflow-hidden"
              style={{
                width: Math.min(sidebarWidth, window.innerWidth * 0.85),
                transform: sidebarCollapsed ? 'translateX(-100%)' : 'translateX(0)',
              }}
            >
              {sidebar}
            </aside>
          )}

          {/* Mobile main content */}
          <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {main}
          </main>
        </div>

        {/* Mobile bottom nav */}
        <nav className="flex-shrink-0 border-t border-border/40 bg-background z-20">
          <NavWrapper collapsed={true}>
            <div className="mobile-nav-bar">
              {nav}
            </div>
          </NavWrapper>
        </nav>
      </div>
    );
  }

  /* ── Desktop layout ── */
  return (
    <div className="h-screen flex bg-background relative overflow-hidden">
      {/* Background gradient orb — behind everything */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute w-[500px] h-[500px] -bottom-32 -left-40 rounded-full bg-[#f5a623]/8 blur-[130px] animate-orb-2" />
      </div>

      {/* Nav — deepest layer */}
      <nav
        className="relative flex flex-col py-3 px-2 overflow-hidden flex-shrink-0"
        style={{ width: navWidth }}
      >
        {typeof nav === 'object' && nav !== null && 'type' in (nav as any)
          ? <NavWrapper collapsed={collapsed}>{nav}</NavWrapper>
          : nav}
      </nav>

      {/* Nav resize handle */}
      <div
        onMouseDown={onNavMouseDown}
        className="relative cursor-col-resize w-[3px] flex-shrink-0"
      />

      {/* Content area */}
      <div className="relative flex-1 py-2 pr-2 min-w-0">
        {hasSidebar ? (
          /* Outer panel — glass wraps sidebar list + detail */
          <div className="glass-panel rounded-xl h-full overflow-hidden flex relative">
            {/* Sidebar list */}
            <aside
              className="flex-shrink-0 overflow-hidden transition-[width] duration-200 ease-out"
              style={{ width: sidebarCollapsed ? 0 : sidebarWidth }}
            >
              {!sidebarCollapsed && sidebar}
            </aside>

            {/* Sidebar toggle — pinned to the divider edge */}
            <button
              onClick={toggleSidebar}
              className="absolute top-2.5 z-40 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-all duration-200"
              style={{ left: sidebarCollapsed ? 8 : sidebarWidth + 8 }}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>

            {/* Gradient orbs */}
            <div className="absolute inset-0 pointer-events-none z-[1]" aria-hidden="true">
              <div className="absolute w-[600px] h-[600px] -top-48 right-[-10%] rounded-full bg-[#DA7756]/8 blur-[150px] animate-orb-1" />
              <div className="absolute w-[350px] h-[350px] top-1/2 left-[40%] -translate-y-1/2 rounded-full bg-[#8b4563]/5 blur-[120px] animate-orb-3" />
            </div>

            {/* Sidebar resize handle — only when sidebar is expanded */}
            {!sidebarCollapsed && (
              <div
                onMouseDown={onSidebarMouseDown}
                className="absolute top-0 bottom-0 w-[6px] cursor-col-resize z-30"
                style={{ left: sidebarWidth - 3 }}
              />
            )}

            {/* Detail panel */}
            <main className="overflow-hidden flex flex-col glass-panel-elevated rounded-xl flex-1 min-w-0 my-2.5 mr-2.5 relative z-[2]">
              {main}
            </main>
          </div>
        ) : (
          /* No sidebar — single glass panel */
          <main className="overflow-hidden flex flex-col glass-panel rounded-xl h-full relative">
            <div className="absolute inset-0 pointer-events-none z-0" aria-hidden="true">
              <div className="absolute w-[600px] h-[600px] -top-48 right-[-10%] rounded-full bg-[#DA7756]/8 blur-[150px] animate-orb-1" />
              <div className="absolute w-[350px] h-[350px] top-1/2 left-[30%] -translate-y-1/2 rounded-full bg-[#8b4563]/5 blur-[120px] animate-orb-3" />
            </div>
            <div className="relative z-[1] flex flex-col flex-1 min-h-0">
              {main}
            </div>
          </main>
        )}
      </div>
    </div>
  );
}

export const NavCollapsedContext = createContext(false);
export function useNavCollapsed() { return useContext(NavCollapsedContext); }

function NavWrapper({ collapsed, children }: { collapsed: boolean; children: ReactNode }) {
  return (
    <NavCollapsedContext.Provider value={collapsed}>
      {children}
    </NavCollapsedContext.Provider>
  );
}
