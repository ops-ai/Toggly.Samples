import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import App from '../src/App';
import { defaults, sections } from '../src/catalog';
afterEach(cleanup);
describe('SolidJS workshop', () => {
  it('shows every contract section, missing-key banner and first-toggle default', async () => {
    render(() => <App config={{ flagDefaults: defaults }} />);
    expect(screen.getByText(/No app key configured/).textContent).toContain('No app key');
    for (const name of sections) expect(screen.getByRole('link', { name })).toBeTruthy();
    await screen.findByText('New dashboard');
    expect(screen.getByText('Standard checkout')).toBeTruthy();
    fireEvent.click(screen.getByText('Evaluate dashboard'));
    expect(screen.getByText('new-dashboard: true')).toBeTruthy();
  });
  it('exercises local gate narrowing and targeting controls offline', async () => {
    render(() => <App config={{ flagDefaults: defaults }} />);
    await screen.findByText('API v2 ready.');
    fireEvent.click(screen.getByLabelText('Device ready for API v2'));
    expect(screen.getByText('API v2 held by remote or local gate.')).toBeTruthy();
    fireEvent.click(screen.getByText('Matching preset'));
    expect((screen.getByLabelText('Identity') as HTMLInputElement).value).toBe('alice');
    fireEvent.click(screen.getByText('Non-matching preset'));
    expect((screen.getByLabelText('Identity') as HTMLInputElement).value).toBe('bob');
    fireEvent.click(screen.getByText('Clear identity, groups and claims'));
    expect((screen.getByLabelText('Identity') as HTMLInputElement).value).toBe('');
  });
});
