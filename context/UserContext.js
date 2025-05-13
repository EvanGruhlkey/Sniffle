import React, { createContext, useState } from 'react';

// Create the context
export const UserContext = createContext();

// Provider component
export const UserProvider = ({ children }) => {
  const [userData, setUserData] = useState(null);
  
  return (
    <UserContext.Provider value={{ userData, setUserData }}>
      {children}
    </UserContext.Provider>
  );
};