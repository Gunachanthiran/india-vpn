import React from 'react';
import renderer, {act} from 'react-test-renderer';
import App from '../App';

describe('App root', () => {
  it('renders auth screen initially', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<App />);
    });
    const json = JSON.stringify(tree!.toJSON());
    expect(json).toContain('INDIA WIREGUARD VPN');
    expect(json).toContain('Sign In');
  });
});
