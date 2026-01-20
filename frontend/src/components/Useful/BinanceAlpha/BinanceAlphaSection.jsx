/**
 * Секция Binance Alpha Tracker для ленивой загрузки
 */

import React, { Suspense, lazy } from 'react';

const BinanceAlphaTracker = lazy(() => import('./BinanceAlphaTracker'));

const BinanceAlphaSection = () => {
    return (
        <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Загрузка...</div>}>
            <BinanceAlphaTracker />
        </Suspense>
    );
};

export default BinanceAlphaSection;


