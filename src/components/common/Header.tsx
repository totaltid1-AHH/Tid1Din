import React from 'react';
import { Sidebar } from './Sidebar';

export { Sidebar };
export const Header: React.FC<{ currentTab: string; setCurrentTab: (tab: string) => void }> = (props) => {
  return <Sidebar {...props} />;
};

export default Header;
