import React, { useEffect, useRef } from 'react';
import Stats from 'stats.js';

export function FpsStats() {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const stats = new Stats();
        stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
        
        // Remove default absolute positioning so we can control it via Tailwind
        stats.dom.style.position = 'relative';
        stats.dom.style.left = '0px';
        stats.dom.style.top = '0px';

        const currentContainer = containerRef.current;
        if (currentContainer) {
            currentContainer.appendChild(stats.dom);
        }

        let reqId: number;
        const animate = () => {
            stats.begin();
            // monitored code goes here technically, but calling begin/end per frame gets us overall FPS
            stats.end();
            reqId = requestAnimationFrame(animate);
        };

        reqId = requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(reqId);
            if (currentContainer && stats.dom.parentNode === currentContainer) {
                currentContainer.removeChild(stats.dom);
            }
        };
    }, []);

    return (
        <div ref={containerRef} className="absolute bottom-4 left-4 z-50 pointer-events-none rounded-md overflow-hidden opacity-80" />
    );
}
