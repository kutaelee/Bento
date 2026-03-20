import React from 'react';
import Card from '../components/Card';
import ListItem from '../components/ListItem';
import StatusIndicator from '../components/StatusIndicator';
import useMockData from '../hooks/useMockData';
import { mockServiceHealth, mockSystemMetrics } from '../mocks/system';

const SystemPage: React.FC = () => {
  const serviceHealth = useMockData(mockServiceHealth);
  const systemMetrics = useMockData(mockSystemMetrics);

  return (
    <div>
      <h1>System Overview</h1>

      <Card title="Service Health">
        {serviceHealth ? (
          serviceHealth.map((service) => (
            <ListItem
              key={service.name}
              label={service.name}
              value={
                <>
                  {service.status.charAt(0).toUpperCase() + service.status.slice(1)} ({service.latency})
                  <StatusIndicator
                    status={service.status === 'operational' ? 'active' : service.status === 'degraded' ? 'warning' : 'error'}
                  />
                </>
              }
            />
          ))
        ) : (
          <p>Loading service health...</p>
        )}
      </Card>

      <Card title="System Metrics">
        {systemMetrics ? (
          <>
            <ListItem label="CPU Usage" value={systemMetrics.cpuUsage} />
            <ListItem label="Memory Usage" value={systemMetrics.memoryUsage} />
            <ListItem label="Disk Usage" value={systemMetrics.diskUsage} />
            <ListItem label="Network Traffic" value={systemMetrics.networkTraffic} />
          </>
        ) : (
          <p>Loading system metrics...</p>
        )}
      </Card>
    </div>
  );
};

export default SystemPage;
