const MobileHeader = ({ children }: { children: React.ReactNode }) => {
  return (
    <header className="glass-header fixed top-0 right-0 left-0 z-20 flex h-[calc(3.5rem+env(safe-area-inset-top,0px))] w-full items-center justify-between px-4 pt-[env(safe-area-inset-top,0px)]">
      {children}
    </header>
  );
};

export default MobileHeader;
