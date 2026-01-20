/**
 * Утилиты для SQL Logs
 */

export const getSQLType = (sql) => {
  const lower = sql.toLowerCase().trim();
  if (lower.startsWith('update')) return 'UPDATE';
  if (lower.startsWith('insert')) return 'INSERT';
  if (lower.startsWith('delete')) return 'DELETE';
  if (lower.startsWith('select')) return 'SELECT';
  return 'OTHER';
};

export const getSQLTypeClass = (type, styles) => {
  switch(type) {
    case 'UPDATE': return styles.typeUpdate;
    case 'INSERT': return styles.typeInsert;
    case 'DELETE': return styles.typeDelete;
    case 'SELECT': return styles.typeSelect;
    default: return styles.typeOther;
  }
};



