import { useUIStore, View } from '../stores/useUIStore';
import { useNavCollapsed } from './Layout';
import { cn } from '../lib/utils';
import {
  LayoutDashboard,
  Layers,
  MessageSquare,
  Workflow,
  Bot,
  Settings,
} from 'lucide-react';

export type { View };

interface NavItem {
  view: View;
  label: string;
  icon: React.ElementType;
  bottom?: boolean;
  mobileHidden?: boolean;
}

const navItems: NavItem[] = [
  { view: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { view: 'tasks', label: 'Tasks', icon: Layers },
  { view: 'sessions', label: 'Sessions', icon: MessageSquare },
  { view: 'cron', label: 'Cron', icon: Workflow, mobileHidden: true },
  { view: 'agents', label: 'Agents', icon: Bot },
  { view: 'settings', label: 'Settings', icon: Settings, bottom: true },
];

function NavButton({ item, active, collapsed, onClick }: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative flex items-center py-2 rounded-lg text-sm font-medium overflow-hidden transition-all duration-150',
        collapsed ? 'justify-center px-2' : 'gap-2.5 px-3',
        active
          ? 'bg-primary/15 text-primary'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent'
      )}
      title={item.label}
    >
      <Icon className={cn(
        'flex-shrink-0 transition-colors',
        active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
      )} size={18} />
      <span className={cn(
        'truncate whitespace-nowrap transition-all duration-150',
        collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
      )}>
        {item.label}
      </span>
    </button>
  );
}

function MobileNavButton({ item, active, onClick }: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 min-w-[48px] rounded-lg transition-colors',
        active
          ? 'text-primary'
          : 'text-muted-foreground active:text-foreground'
      )}
    >
      <Icon size={20} />
      <span className="text-[10px] leading-tight">{item.label}</span>
    </button>
  );
}

export default function NavSidebar() {
  const view = useUIStore(s => s.view);
  const setView = useUIStore(s => s.setView);
  const collapsed = useNavCollapsed();

  const mainItems = navItems.filter(i => !i.bottom);
  const bottomItems = navItems.filter(i => i.bottom);
  const allItems = navItems;

  // Detect if we're in mobile nav bar context (parent has .mobile-nav-bar)
  // We render differently based on whether we're in the bottom bar or the side nav
  const isMobileBar = typeof window !== 'undefined' && window.innerWidth < 768;

  if (isMobileBar) {
    const mobileItems = allItems.filter(i => !i.mobileHidden);
    return (
      <div className="flex items-center justify-around px-1 py-1 safe-area-bottom">
        {mobileItems.map(item => (
          <MobileNavButton
            key={item.view}
            item={item}
            active={view === item.view}
            onClick={() => setView(item.view)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col justify-between h-full gap-2">
      {/* Logo / brand */}
      <div className={cn(
        'flex items-center mb-2 overflow-hidden',
        collapsed ? 'justify-center px-2' : 'gap-2 px-3'
      )}>
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-claude to-orange-400 flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-sm">C</span>
        </div>
        <span className={cn(
          'font-semibold text-foreground text-sm tracking-tight whitespace-nowrap transition-all duration-150',
          collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
        )}>
          Claudit
        </span>
      </div>

      {/* Main nav */}
      <div className="flex flex-col gap-0.5 flex-1">
        {mainItems.map(item => (
          <NavButton
            key={item.view}
            item={item}
            active={view === item.view}
            collapsed={collapsed}
            onClick={() => setView(item.view)}
          />
        ))}
      </div>

      {/* Bottom nav */}
      <div className="flex flex-col gap-0.5">
        {bottomItems.map(item => (
          <NavButton
            key={item.view}
            item={item}
            active={view === item.view}
            collapsed={collapsed}
            onClick={() => setView(item.view)}
          />
        ))}
      </div>
    </div>
  );
}
