import React from 'react';
import renderer, {act} from 'react-test-renderer';
import App from '../App';

describe('App root', () => {
  it('opens directly onto 1-tap VPN home screen without forcing login', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<App />);
    });
    const json = JSON.stringify(tree!.toJSON());
    expect(json).toContain('India WireGuard VPN');
    expect(json).toContain('CONNECT');
    expect(json).toContain('BGMI Gaming Profile');
  });
});
