import React, { createContext, useContext, ReactNode } from 'react';
import { usePhysicsSettings } from './usePhysicsSettings';

type PhysicsConfigContextType = ReturnType<typeof usePhysicsSettings>;

const PhysicsConfigContext = createContext<PhysicsConfigContextType | null>(null);

export function PhysicsConfigProvider({ children, settings }: { children: ReactNode, settings: PhysicsConfigContextType }) {
    return (
        <PhysicsConfigContext.Provider value={settings}>
            {children}
        </PhysicsConfigContext.Provider>
    );
}

export function usePhysicsConfig() {
    const context = useContext(PhysicsConfigContext);
    if (!context) {
        throw new Error('usePhysicsConfig must be used within a PhysicsConfigProvider');
    }
    return context;
}
