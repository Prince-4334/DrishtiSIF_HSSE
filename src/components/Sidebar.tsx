import shieldLogo from '../pages/shield-logo.png';
import { Shield, LayoutGrid, FileSearch, ClipboardList, TrendingUp, Lock, Info, type LucideIcon } from 'lucide-react';

export type PageId = 'overview' | 'analyze' | 'reports' | 'patterns' | 'rules' | 'about';

interface SidebarProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
}

const NAV_ITEMS: { id: PageId; label: string; icon: LucideIcon }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'analyze', label: 'Analyze Report', icon: FileSearch },
  { id: 'reports', label: 'SIF Reports', icon: ClipboardList },
  { id: 'patterns', label: 'Precursor Patterns', icon: TrendingUp },
  { id: 'rules', label: 'Life-Saving Rules', icon: Lock },
  { id: 'about', label: 'About', icon: Info },
];

export default function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  return (
    <aside
      className="w-60 min-h-screen flex flex-col shrink-0 border-r"
      style={{ backgroundColor: '#ffffff', borderColor: 'var(--color-border)' }}
    >
      <div
        className="px-5 py-5 border-b"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div className="flex items-center gap-2.5">
         <img 
        src={shieldLogo} 
        alt="Drishti SIF" 
        className="w-9 h-9 object-contain shrink-0" 
      />
      <div>
        <div
          className="font-semibold text-[15px] leading-tight tracking-wide"
          style={{ color: 'var(--color-text)' }}
        >
          Drishti <span style={{ color: '#dc2626' }}>SIF</span>
        </div>
            <div className="text-[11px] leading-tight mt-0.5" style={{ color: 'var(--color-text-light)' }}>
              HSE Intelligence Platform
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-3 px-3 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`nav-item w-full flex items-center gap-2.5 text-left px-3 py-2.5 rounded-lg text-[14px] font-medium ${
                active ? '' : ''
              }`}
              style={{
                color: active ? 'var(--color-primary)' : 'var(--color-text)',
                backgroundColor: active ? '#eef2f7' : 'transparent',
              }}
            >
              <Icon
                size={17}
                strokeWidth={active ? 2.25 : 1.75}
                className={active ? '' : 'opacity-60'}
              />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div
        className="px-5 py-4 border-t text-[11px] leading-relaxed"
        style={{
          borderColor: 'var(--color-border)',
          color: 'var(--color-text-light)',
        }}
      >
        AI-assisted screening for HSE review — not a final safety decision.
      </div>
    </aside>
  );
}
