import React from 'react';

/**
 * ErrorBoundary - компонент для перехвата ошибок в React дереве
 * 
 * ErrorBoundary работает как try-catch для React компонентов. Ловит ошибки в:
 * - render() методе
 * - lifecycle методах
 * - конструкторах дочерних компонентов
 * 
 * НЕ ловит ошибки в:
 * - Event handlers (onClick и т.д.) - там нужен try-catch
 * - Асинхронном коде (setTimeout, promises) - там нужен .catch
 * - Server-side rendering
 * - Самом ErrorBoundary
 * 
 * Но это все равно критично! Одна ошибка в render не должна крашить все приложение!
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    // Обновляем state чтобы показать fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Поймана ошибка:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
    
    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // При необходимости можно интегрировать систему мониторинга ошибок (Sentry, LogRocket и т.д.)
    // if (window.Sentry) {
    //   window.Sentry.captureException(error, { extra: errorInfo });
    // }
  }

  handleReset = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '20px',
          backgroundColor: '#f5f5f5',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{
            maxWidth: '600px',
            background: 'white',
            padding: '40px',
            borderRadius: '12px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            textAlign: 'center'
          }}>
            <h1 style={{ 
              fontSize: '48px', 
              margin: '0 0 20px 0',
              color: '#e74c3c'
            }}>
              Ой! 😔
            </h1>
            
            <h2 style={{ 
              fontSize: '24px', 
              margin: '0 0 16px 0',
              color: '#2c3e50',
              fontWeight: '600'
            }}>
              Что-то пошло не так
            </h2>
            
            <p style={{ 
              fontSize: '16px', 
              color: '#7f8c8d',
              lineHeight: '1.6',
              margin: '0 0 32px 0'
            }}>
              Произошла непредвиденная ошибка. Мы уже работаем над её исправлением.
              Попробуйте перезагрузить страницу.
            </p>
            
            <button
              onClick={this.handleReset}
              style={{
                backgroundColor: '#3498db',
                color: 'white',
                border: 'none',
                padding: '12px 32px',
                fontSize: '16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#2980b9'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#3498db'}
            >
              Перезагрузить страницу
            </button>
            
            {/* Детали ошибки только в development */}
            {import.meta.env.DEV && this.state.error && (
              <details style={{ 
                marginTop: '32px', 
                textAlign: 'left',
                padding: '16px',
                backgroundColor: '#f8f9fa',
                borderRadius: '6px',
                fontSize: '14px'
              }}>
                <summary style={{ 
                  cursor: 'pointer', 
                  fontWeight: '600',
                  marginBottom: '12px',
                  color: '#e74c3c'
                }}>
                  Детали ошибки (только в dev режиме)
                </summary>
                <pre style={{ 
                  whiteSpace: 'pre-wrap', 
                  wordBreak: 'break-word',
                  fontSize: '12px',
                  color: '#2c3e50'
                }}>
                  {this.state.error.toString()}
                  {this.state.errorInfo && this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    // Нормальный рендер дочерних компонентов
    return this.props.children;
  }
}

export default ErrorBoundary;

