import { useState, useEffect } from 'react';

function useMockData<T>(data: T, delay: number = 500): T | null {
  const [mockData, setMockData] = useState<T | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMockData(data);
    }, delay);

    return () => clearTimeout(timer);
  }, [data, delay]);

  return mockData;
}

export default useMockData;
