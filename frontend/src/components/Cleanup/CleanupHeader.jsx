import React from 'react';
import { FiTrash2 } from 'react-icons/fi';
import PageHeader from '../PageHeader';

/**
 * Шапка страницы очистки
 */
const CleanupHeader = () => {
  return (
    <PageHeader 
      icon={<FiTrash2 />} 
      title="Очистка данных" 
      gradient="orange"
    />
  );
};

export default CleanupHeader;



