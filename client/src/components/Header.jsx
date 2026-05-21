import React from 'react';
import { Link } from 'react-router-dom';
import usePushNotifications from '../hooks/usePushNotifications';
import useNotifications from '../hooks/useNotifications';

const Header = () => {
  const { subscribe, isSubscribed, loading } = usePushNotifications();
  const { unreadCount } = useNotifications();

  return (
    <header className="sticky top-0 w-full z-50 flex items-center justify-between px-4 md:px-6 h-14 md:h-16 bg-slate-950/80 backdrop-blur-xl border-b border-white/10 shadow-none">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-blue-500 dark:text-blue-400 text-[20px] md:text-[24px]">volume_up</span>
        <span className="text-lg md:text-xl font-black text-blue-500 dark:text-blue-400">Digital Ear</span>
      </div>
      <div className="flex items-center gap-2 md:gap-margin mr-10 md:mr-0">
        <Link 
          to="/notifications" 
          className="relative text-slate-400 hover:bg-white/5 transition-all duration-300 p-1.5 md:p-sm rounded-full flex items-center justify-center"
        >
          <span className="material-symbols-outlined text-[20px] md:text-[24px]">notifications</span>
          {unreadCount > 0 && (
            <span className="absolute top-0.5 right-0.5 md:top-1 md:right-1 w-2 h-2 bg-error rounded-full animate-pulse"></span>
          )}
        </Link>
        <button 
          onClick={subscribe}
          disabled={isSubscribed || loading}
          className={`font-data-sm px-2 md:px-md py-1 md:py-sm rounded transition-all duration-500 text-[10px] md:text-xs ${
            isSubscribed 
            ? 'bg-surface-container-highest text-outline cursor-default' 
            : 'bg-primary text-on-primary hover:shadow-[0_0_10px_rgba(173,198,255,0.8)] hover:bg-primary-fixed'
          }`}
        >
          {loading ? '...' : isSubscribed ? '✓' : 'Subscribe'}
          <span className="hidden md:inline"> {loading ? '' : isSubscribed ? 'Subscribed' : 'to Alerts'}</span>
        </button>
      </div>
    </header>
  );
};

export default Header;
