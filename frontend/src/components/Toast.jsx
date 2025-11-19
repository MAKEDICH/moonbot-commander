import { motion } from 'framer-motion';
import { FiCheckCircle, FiXCircle, FiAlertTriangle, FiInfo, FiX } from 'react-icons/fi';

const Toast = ({ message, type = 'info', onClose }) => {
  const config = {
    success: {
      icon: FiCheckCircle,
      color: '#10b981',
      bgGradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.05) 100%)',
      borderColor: 'rgba(16, 185, 129, 0.3)',
    },
    error: {
      icon: FiXCircle,
      color: '#ef4444',
      bgGradient: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.05) 100%)',
      borderColor: 'rgba(239, 68, 68, 0.3)',
    },
    warning: {
      icon: FiAlertTriangle,
      color: '#f59e0b',
      bgGradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(217, 119, 6, 0.05) 100%)',
      borderColor: 'rgba(245, 158, 11, 0.3)',
    },
    info: {
      icon: FiInfo,
      color: '#3b82f6',
      bgGradient: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.05) 100%)',
      borderColor: 'rgba(59, 130, 246, 0.3)',
    },
  };

  const currentConfig = config[type] || config.info;
  const Icon = currentConfig.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.9 }}
      transition={{
        type: 'spring',
        stiffness: 500,
        damping: 30,
      }}
      style={{
        background: currentConfig.bgGradient,
        backdropFilter: 'blur(12px)',
        borderRadius: '12px',
        padding: '16px',
        paddingRight: '48px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
        border: `1px solid ${currentConfig.borderColor}`,
        position: 'relative',
        minWidth: '300px',
        maxWidth: '400px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
      }}
    >
      {/* Icon */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 300 }}
      >
        <Icon
          size={24}
          style={{ color: currentConfig.color, flexShrink: 0 }}
        />
      </motion.div>

      {/* Message */}
      <div
        style={{
          flex: 1,
          color: '#fff',
          fontSize: '14px',
          lineHeight: '1.5',
          wordBreak: 'break-word',
        }}
      >
        {message}
      </div>

      {/* Close Button */}
      <motion.button
        whileHover={{ scale: 1.1, rotate: 90 }}
        whileTap={{ scale: 0.9 }}
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          background: 'rgba(255, 255, 255, 0.1)',
          border: 'none',
          borderRadius: '50%',
          width: '24px',
          height: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'rgba(255, 255, 255, 0.6)',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
          e.currentTarget.style.color = '#fff';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
          e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)';
        }}
      >
        <FiX size={14} />
      </motion.button>

      {/* Animated Progress Bar */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 4, ease: 'linear' }}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: currentConfig.color,
          borderBottomLeftRadius: '12px',
          borderBottomRightRadius: '12px',
          transformOrigin: 'left',
          opacity: 0.5,
        }}
      />
    </motion.div>
  );
};

export default Toast;





