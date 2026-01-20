import { motion, AnimatePresence } from 'framer-motion';
import { FiAlertTriangle, FiInfo, FiCheckCircle } from 'react-icons/fi';

const ConfirmModal = ({
  title = 'Подтверждение',
  message = 'Вы уверены?',
  confirmText = 'Подтвердить',
  cancelText = 'Отмена',
  type = 'warning', // 'warning' | 'danger' | 'info' | 'success'
  onConfirm,
  onCancel,
}) => {
  const typeConfig = {
    warning: {
      icon: FiAlertTriangle,
      color: '#f59e0b',
      confirmBg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    },
    danger: {
      icon: FiAlertTriangle,
      color: '#ef4444',
      confirmBg: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    },
    info: {
      icon: FiInfo,
      color: '#3b82f6',
      confirmBg: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    },
    success: {
      icon: FiCheckCircle,
      color: '#10b981',
      confirmBg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    },
  };

  const config = typeConfig[type] || typeConfig.warning;
  const Icon = config.icon;

  return (
    <AnimatePresence>
      {/* Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onCancel}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(4px)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
        }}
      >
        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{
            type: 'spring',
            stiffness: 400,
            damping: 30,
          }}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'linear-gradient(145deg, #1a1a2e 0%, #16213e 100%)',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '80vh',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Icon */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 300 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: `${config.color}15`,
              margin: '0 auto 24px',
            }}
          >
            <Icon size={32} style={{ color: config.color }} />
          </motion.div>

          {/* Title */}
          <h3
            style={{
              color: '#fff',
              fontSize: '24px',
              fontWeight: '600',
              textAlign: 'center',
              marginBottom: '12px',
            }}
          >
            {title}
          </h3>

          {/* Message */}
          <div
            style={{
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: '15px',
              lineHeight: '1.6',
              textAlign: 'center',
              marginBottom: '32px',
              whiteSpace: 'pre-line',
              maxHeight: '300px',
              overflowY: 'auto',
              overflowX: 'hidden',
              padding: '0 8px',
              wordBreak: 'break-word',
            }}
          >
            {message}
          </div>

          {/* Buttons */}
          <div
            style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center',
            }}
          >
            {/* Cancel Button - скрываем если cancelText = null */}
            {cancelText && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onCancel}
                style={{
                  flex: 1,
                  padding: '12px 24px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '10px',
                  color: '#fff',
                  fontSize: '15px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                }}
              >
                {cancelText}
              </motion.button>
            )}

            {/* Confirm Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onConfirm}
              style={{
                flex: cancelText ? 1 : 'none',
                minWidth: cancelText ? 'auto' : '200px',
                padding: '12px 24px',
                background: config.confirmBg,
                border: 'none',
                borderRadius: '10px',
                color: '#fff',
                fontSize: '15px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: `0 4px 16px ${config.color}40`,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = `0 6px 20px ${config.color}60`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = `0 4px 16px ${config.color}40`;
              }}
            >
              {confirmText}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ConfirmModal;





