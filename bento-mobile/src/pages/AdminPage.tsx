import React from 'react';
import Card from '../components/Card';
import ListItem from '../components/ListItem';
import StatusIndicator from '../components/StatusIndicator';
import useMockData from '../hooks/useMockData';
import { mockUsers, mockJobStatuses } from '../mocks/admin';

const AdminPage: React.FC = () => {
  const users = useMockData(mockUsers);
  const jobStatuses = useMockData(mockJobStatuses);

  return (
    <div>
      <h1>Admin Dashboard</h1>

      <Card title="User Management">
        {users ? (
          users.map((user) => (
            <ListItem
              key={user.id}
              label={user.name}
              value={
                <>
                  {user.email}
                  <StatusIndicator
                    status={user.status === 'active' ? 'active' : user.status === 'inactive' ? 'inactive' : 'pending'}
                  />
                </>
              }
            />
          ))
        ) : (
          <p>Loading users...</p>
        )}
      </Card>

      <Card title="Job Status">
        {jobStatuses ? (
          jobStatuses.map((job) => (
            <ListItem
              key={job.id}
              label={job.name}
              value={
                <>
                  {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                  <StatusIndicator
                    status={job.status === 'success' ? 'active' : job.status === 'running' ? 'pending' : 'error'}
                  />
                </>
              }
            />
          ))
        ) : (
          <p>Loading job statuses...</p>
        )}
      </Card>
    </div>
  );
};

export default AdminPage;
