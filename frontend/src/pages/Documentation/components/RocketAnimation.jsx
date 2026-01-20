/**
 * Пасхалка: Анимация ракеты Mike
 * Оптимизированная версия с частицами огня и салютом
 */
import React, { useState, useEffect, useRef } from 'react';
import moonbotIcon from '../../../assets/moonbot-icon.png';

const RocketAnimation = ({ onComplete, startPos }) => {
  const [phase, setPhase] = useState('transform');
  const [renderKey, setRenderKey] = useState(0);
  const [transformProgress, setTransformProgress] = useState(0);
  
  const stateRef = useRef({
    rocketPos: { ...startPos },
    rocketAngle: -Math.PI / 2,
    particles: [],
    fireworks: [],
    startTime: Date.now(),
    startPos: { ...startPos },
    spiralAngle: 0,
    spiralRadius: 0,
    frameCount: 0
  });

  // Оптимизированная генерация частиц огня (меньше частиц)
  const generateFireParticles = (x, y, angle) => {
    if (Math.random() > 0.7) return [];
    const spread = (Math.random() - 0.5) * 0.4;
    return [{
      x: x + (Math.random() - 0.5) * 4,
      y: y + (Math.random() - 0.5) * 4,
      vx: Math.cos(angle + spread) * (2 + Math.random() * 1.5),
      vy: Math.sin(angle + spread) * (2 + Math.random() * 1.5),
      life: 1,
      color: ['#ff6b35', '#ffaa00', '#ff4444', '#ffff00'][Math.floor(Math.random() * 4)],
      size: 4 + Math.random() * 5
    }];
  };

  // Красочный салют
  const generateFirework = (x, y) => {
    const colors = [
      '#ff0055', '#ff3366', '#ff6699',
      '#00ff88', '#33ff99', '#66ffaa',
      '#ffaa00', '#ffcc33', '#ffdd66',
      '#00aaff', '#33bbff', '#66ccff',
      '#ff00ff', '#ff66ff', '#ffaaff',
      '#ffff00', '#ffffff', '#00ffff'
    ];
    const particles = [];
    const num = 45;
    for (let i = 0; i < num; i++) {
      const angle = (Math.PI * 2 * i) / num + (Math.random() - 0.5) * 0.4;
      const speed = 1.5 + Math.random() * 5;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 3 + Math.random() * 3
      });
    }
    return particles;
  };

  // Магические частицы (минимум)
  const generateMagicParticles = (x, y) => {
    if (Math.random() > 0.5) return [];
    const colors = ['#00ff88', '#ffaa00', '#ff6b35'];
    return [{
      x, y,
      vx: (Math.random() - 0.5) * 3,
      vy: (Math.random() - 0.5) * 3,
      life: 1,
      color: colors[Math.floor(Math.random() * 3)],
      size: 3 + Math.random() * 3
    }];
  };

  useEffect(() => {
    let frameId;
    const state = stateRef.current;
    const screenCenter = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    
    const animate = () => {
      const now = Date.now();
      const elapsed = now - state.startTime;
      state.frameCount++;
      
      // Обновляем частицы каждый кадр (оптимизировано)
      const maxParticles = 50;
      state.particles = state.particles
        .filter(p => p.life > 0.05)
        .slice(-maxParticles)
        .map(p => ({
          ...p, 
          x: p.x + p.vx, 
          y: p.y + p.vy, 
          vy: p.vy + 0.1,
          life: p.life - 0.03, 
          size: p.size * 0.96
        }));
      
      if (phase === 'transform') {
        const progress = Math.min(elapsed / 400, 1);
        if (state.frameCount % 3 === 0) setTransformProgress(progress);
        
        state.particles.push(...generateMagicParticles(state.startPos.x, state.startPos.y));
        
        if (progress >= 1) { 
          setPhase('launch');
          state.startTime = now;
          state.rocketAngle = -Math.PI / 2;
        }
      } else if (phase === 'launch') {
        const progress = Math.min(elapsed / 700, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        
        const topY = 50;
        state.rocketPos.x = state.startPos.x;
        state.rocketPos.y = state.startPos.y - (state.startPos.y - topY) * easeProgress;
        state.rocketAngle = -Math.PI / 2;
        
        state.particles.push(...generateFireParticles(state.rocketPos.x, state.rocketPos.y + 28, Math.PI / 2));
        
        if (progress >= 1) { 
          setPhase('spiral');
          state.startTime = now;
          state.spiralAngle = -Math.PI / 2;
          state.spiralRadius = Math.max(
            Math.abs(screenCenter.x - state.rocketPos.x),
            Math.abs(screenCenter.y - state.rocketPos.y)
          ) * 0.7;
        }
      } else if (phase === 'spiral') {
        const progress = Math.min(elapsed / 2500, 1);
        const speedMult = 1 + progress * 2.5;
        const currentRadius = state.spiralRadius * (1 - progress);
        const rotations = 2.5 + progress * 1.5;
        const currentAngle = state.spiralAngle + Math.PI * 2 * rotations * progress * speedMult * 0.35;
        
        state.rocketPos.x = screenCenter.x + Math.cos(currentAngle) * currentRadius;
        state.rocketPos.y = screenCenter.y + Math.sin(currentAngle) * currentRadius;
        state.rocketAngle = currentAngle + Math.PI / 2;
        
        const flameAngle = state.rocketAngle + Math.PI;
        state.particles.push(...generateFireParticles(
          state.rocketPos.x + Math.cos(flameAngle) * 22,
          state.rocketPos.y + Math.sin(flameAngle) * 22,
          flameAngle
        ));
        
        if (progress >= 1 || currentRadius < 12) {
          state.particles = [];
          state.fireworks = [];
          for (let i = 0; i < 6; i++) {
            state.fireworks.push(...generateFirework(
              screenCenter.x + (Math.random() - 0.5) * 180,
              screenCenter.y + (Math.random() - 0.5) * 120
            ));
          }
          setPhase('explode');
          state.startTime = now;
        }
      } else if (phase === 'explode' || phase === 'thanks') {
        state.fireworks = state.fireworks
          .filter(p => p.life > 0.01)
          .map(p => ({
            ...p, 
            x: p.x + p.vx, 
            y: p.y + p.vy, 
            vy: p.vy + 0.008,
            vx: p.vx * 0.997,
            life: p.life - 0.003,
            size: p.size * 0.997
          }));
        
        if (phase === 'explode' && elapsed > 2000) {
          setPhase('thanks');
          state.startTime = now;
        }
        
        if (phase === 'thanks' && elapsed > 4000) { 
          onComplete(); 
          return; 
        }
      }
      
      if (state.frameCount % 2 === 0) {
        setRenderKey(k => k + 1);
      }
      
      frameId = requestAnimationFrame(animate);
    };
    
    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [phase, onComplete]);

  const state = stateRef.current;
  
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 99999,
      pointerEvents: phase === 'thanks' ? 'auto' : 'none',
      background: phase === 'explode' || phase === 'thanks' 
        ? 'radial-gradient(ellipse at center, rgba(20,10,40,0.95) 0%, rgba(5,5,15,0.98) 100%)' : 'transparent',
      transition: 'background 0.5s ease'
    }} onClick={phase === 'thanks' ? onComplete : undefined}>
      {/* Частицы огня */}
      {state.particles.map((p, i) => (
        <div key={i} style={{
          position: 'absolute', left: p.x, top: p.y, 
          width: p.size, height: p.size,
          borderRadius: '50%', 
          background: p.color, 
          boxShadow: `0 0 ${p.size}px ${p.color}`,
          opacity: p.life, 
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          willChange: 'transform, opacity'
        }} />
      ))}
      
      {/* Фаза превращения: гусеница -> логотип */}
      {phase === 'transform' && (
        <div style={{
          position: 'absolute', 
          left: state.startPos.x, 
          top: state.startPos.y,
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <span style={{
            position: 'absolute',
            fontSize: '36px',
            opacity: 1 - transformProgress,
            transform: `scale(${1 + transformProgress * 0.3}) rotate(${transformProgress * 360}deg)`,
            filter: `blur(${transformProgress * 2}px)`
          }}>🐛</span>
          
          <img 
            src={moonbotIcon} 
            alt="Rocket"
            style={{
              position: 'absolute',
              width: 45,
              height: 45,
              opacity: transformProgress,
              transform: `scale(${0.5 + transformProgress * 0.5}) rotate(${(1 - transformProgress) * -180}deg)`,
              filter: `drop-shadow(0 0 ${15 * transformProgress}px rgba(0,255,136,0.7))`
            }}
          />
          
          {transformProgress > 0.4 && transformProgress < 0.8 && (
            <div style={{
              position: 'absolute',
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(0,255,136,0.5) 0%, transparent 70%)'
            }} />
          )}
        </div>
      )}
      
      {/* Ракета в полёте */}
      {(phase === 'launch' || phase === 'spiral') && (() => {
        const rotationDeg = (state.rocketAngle * 180 / Math.PI) + 45;
        const flameAngle = state.rocketAngle + Math.PI;
        const flameX = state.rocketPos.x + Math.cos(flameAngle) * 28;
        const flameY = state.rocketPos.y + Math.sin(flameAngle) * 28;
        
        return (
          <>
            <div style={{
              position: 'absolute', 
              left: state.rocketPos.x, 
              top: state.rocketPos.y,
              transform: `translate(-50%, -50%) rotate(${rotationDeg}deg)`,
              willChange: 'transform'
            }}>
              <img 
                src={moonbotIcon} 
                alt="Rocket" 
                style={{ 
                  width: 45, 
                  height: 45, 
                  filter: 'drop-shadow(0 0 15px rgba(255,100,50,0.7))' 
                }} 
              />
            </div>
            <div style={{
              position: 'absolute', 
              left: flameX,
              top: flameY,
              transform: `translate(-50%, -50%) rotate(${(flameAngle * 180 / Math.PI) + 90}deg)`,
              width: 20, 
              height: 38, 
              background: 'linear-gradient(to bottom, #ff6600 0%, #ffaa00 30%, #ff4400 60%, transparent 100%)',
              borderRadius: '50% 50% 40% 40%', 
              animation: 'flicker 0.08s infinite alternate', 
              filter: 'blur(3px)',
              opacity: 0.85,
              willChange: 'transform'
            }} />
          </>
        );
      })()}
      
      {/* Салюты */}
      {(phase === 'explode' || phase === 'thanks') && state.fireworks.map((p, i) => (
        <div key={i} style={{
          position: 'absolute', left: p.x, top: p.y, 
          width: p.size, height: p.size,
          borderRadius: '50%', 
          background: p.color,
          boxShadow: `0 0 ${p.size * 3}px ${p.color}, 0 0 ${p.size * 6}px ${p.color}`,
          opacity: Math.min(p.life * 1.2, 1), 
          transform: 'translate(-50%, -50%)',
          willChange: 'transform, opacity'
        }} />
      ))}
      
      {/* Благодарность */}
      {phase === 'thanks' && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', animation: 'fadeInScale 0.8s ease-out forwards' }}>
          <div style={{
            fontSize: 'clamp(2rem, 8vw, 5rem)', fontWeight: 900,
            background: 'linear-gradient(135deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3, #54a0ff)',
            backgroundSize: '300% 300%', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            animation: 'gradientMove 2s ease infinite', marginBottom: 20
          }}>Спасибо Mike!</div>
          <div style={{ fontSize: 'clamp(3rem, 10vw, 6rem)', animation: 'heartbeat 0.8s ease-in-out infinite' }}>❤️</div>
          <div style={{ marginTop: 30, fontSize: '1rem', color: 'rgba(255,255,255,0.6)', animation: 'fadeIn 1s ease-out 0.5s forwards', opacity: 0 }}>
            Нажмите чтобы закрыть
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes flicker { 0% { opacity: 0.8; transform: translateX(-50%) scaleY(1); } 100% { opacity: 1; transform: translateX(-50%) scaleY(1.2); } }
        @keyframes fadeInScale { 0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); } 100% { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
        @keyframes gradientMove { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        @keyframes heartbeat { 0%, 100% { transform: scale(1); } 25% { transform: scale(1.1); } 50% { transform: scale(1); } 75% { transform: scale(1.15); } }
        @keyframes fadeIn { to { opacity: 1; } }
        @keyframes pulse { 0% { transform: scale(0.5); opacity: 1; } 100% { transform: scale(2); opacity: 0; } }
      `}</style>
    </div>
  );
};

export default RocketAnimation;

