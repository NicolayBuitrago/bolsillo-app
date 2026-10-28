import { render, screen, userEvent } from '@testing-library/react-native';
import { HealthStatusView } from './health-status';
import { healthStrings as t } from './strings';

describe('HealthStatusView', () => {
  it('shows both services as operational', async () => {
    await render(<HealthStatusView api="ok" db="ok" onRetry={jest.fn()} retrying={false} />);
    expect(screen.getByText(t.title)).toBeOnTheScreen();
    expect(screen.getAllByText(t.ok)).toHaveLength(2);
    expect(screen.queryByRole('button', { name: t.retry })).toBeNull();
  });

  it('shows loading state', async () => {
    await render(
      <HealthStatusView api="loading" db="loading" onRetry={jest.fn()} retrying={false} />,
    );
    expect(screen.getAllByText(t.loading)).toHaveLength(2);
  });

  it('reports a degraded database while the API is up', async () => {
    await render(<HealthStatusView api="ok" db="down" onRetry={jest.fn()} retrying={false} />);
    expect(screen.getByText(t.ok)).toBeOnTheScreen();
    expect(screen.getByText(t.down)).toBeOnTheScreen();
  });

  it('offers a retry when the API is unreachable', async () => {
    const user = userEvent.setup();
    const onRetry = jest.fn();
    await render(<HealthStatusView api="down" db="down" onRetry={onRetry} retrying={false} />);
    expect(screen.getByText(t.unreachable)).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: t.retry }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
