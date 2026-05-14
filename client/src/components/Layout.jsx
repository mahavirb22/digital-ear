import React from 'react';
import Header from './Header';
import Sidebar from './Sidebar';

const Layout = ({ children }) => {
  return (
    <div className="bg-[#0A0E1A] text-on-surface min-h-screen flex flex-col overflow-x-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col w-full md:pl-64">
        <Header />
        <main className="flex-1 p-4 md:p-margin flex flex-col gap-4 md:gap-margin">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
