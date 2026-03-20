export const mockServiceHealth = [
  { name: 'API Gateway', status: 'operational', latency: '50ms' },
  { name: 'Database Service', status: 'operational', latency: '20ms' },
  { name: 'Auth Service', status: 'operational', latency: '30ms' },
  { name: 'Storage Service', status: 'degraded', latency: '200ms' }
];

export const mockSystemMetrics = {
  cpuUsage: '25%',
  memoryUsage: '60%',
  diskUsage: '75%',
  networkTraffic: '100Mbps'
};
