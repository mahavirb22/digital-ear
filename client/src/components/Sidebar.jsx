import React, { useContext, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const navLinkClass = ({ isActive }) =>
  `flex items-center px-4 py-3 transition-colors ${
    isActive
      ? 'bg-blue-500/10 text-blue-400 border-r-2 border-blue-500'
      : 'text-slate-500 hover:text-blue-300 hover:bg-white/5'
  }`;

const Sidebar = () => {
  const { logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
    setMobileOpen(false);
  };

  const closeMobile = () => setMobileOpen(false);

  const navLinks = (
    <>
      <NavLink to="/" end className={navLinkClass} onClick={closeMobile}>
        <span className="material-symbols-outlined mr-sm text-[20px]">grid_view</span>
        Dashboard
      </NavLink>
      <NavLink to="/notifications" className={navLinkClass} onClick={closeMobile}>
        <span className="material-symbols-outlined mr-sm text-[20px]">analytics</span>
        Alerts
      </NavLink>
      <NavLink to="/connect-device" className={navLinkClass} onClick={closeMobile}>
        <span className="material-symbols-outlined mr-sm text-[20px]">settings_input_component</span>
        Devices
      </NavLink>
      <NavLink to="/motor-twin" className={navLinkClass} onClick={closeMobile}>
        <span className="material-symbols-outlined mr-sm text-[20px]">3d_rotation</span>
        3D Model
      </NavLink>
    </>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-[18px] right-4 z-[60] md:hidden text-slate-400 hover:text-white transition-colors p-1"
        aria-label="Open menu"
      >
        <span className="material-symbols-outlined text-[28px]">menu</span>
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] md:hidden"
          onClick={closeMobile}
        />
      )}

      {/* Mobile drawer */}
      <nav
        className={`fixed top-0 right-0 h-full w-64 z-[80] bg-slate-950/95 backdrop-blur-2xl text-blue-500 font-mono uppercase text-xs tracking-widest font-bold border-l border-white/10 shadow-2xl shadow-black/50 flex flex-col transition-transform duration-300 ease-in-out md:hidden ${
          mobileOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Close button */}
        <div className="flex items-center justify-between p-gutter border-b border-white/10">
          <div className="flex items-center gap-sm">
            <span className="material-symbols-outlined text-blue-500 text-[20px]">volume_up</span>
            <span className="text-sm font-black text-blue-400 normal-case tracking-normal">Digital Ear</span>
          </div>
          <button onClick={closeMobile} className="text-slate-400 hover:text-white transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Profile section */}
        <div className="p-gutter border-b border-white/10">
          <div className="flex items-center gap-sm">
            <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center border border-white/10">
              <span className="material-symbols-outlined text-on-surface text-[16px]">person</span>
            </div>
            <div>
              <div className="font-data-sm text-on-surface">Command Center</div>
              <div className="font-data-sm text-outline-variant text-[10px]">Station 04 - Active</div>
            </div>
          </div>
        </div>

        {/* Nav links */}
        <div className="flex-1 overflow-y-auto py-sm">
          {navLinks}
        </div>

        {/* Logout */}
        <div className="border-t border-white/10 p-sm">
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-3 text-slate-500 hover:text-error hover:bg-error/5 transition-colors rounded"
          >
            <span className="material-symbols-outlined mr-sm text-[20px]">logout</span>
            Logout
          </button>
        </div>
      </nav>

      {/* Desktop sidebar (unchanged behavior) */}
      <nav className="fixed left-0 top-16 h-[calc(100vh-64px)] hidden md:flex flex-col z-40 bg-slate-950/90 backdrop-blur-2xl text-blue-500 dark:text-blue-400 font-mono uppercase text-xs tracking-widest font-bold w-64 border-r border-white/10 shadow-2xl shadow-black/50 transition-colors duration-200 ease-in-out">
        <div className="p-gutter border-b border-white/10">
          <div className="flex items-center gap-sm mb-xs">
            <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center border border-white/10">
              <span className="material-symbols-outlined text-on-surface text-[16px]">person</span>
            </div>
            <div>
              <div className="font-data-sm text-on-surface">Command Center</div>
              <div className="font-data-sm text-outline-variant text-[10px]">Station 04 - Active</div>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-sm">
          {navLinks}
        </div>
        <div className="border-t border-white/10 p-sm">
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-3 text-slate-500 hover:text-error hover:bg-error/5 transition-colors rounded"
          >
            <span className="material-symbols-outlined mr-sm text-[20px]">logout</span>
            Logout
          </button>
        </div>
      </nav>
    </>
  );
};

export default Sidebar;
