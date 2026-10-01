import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LoginPage } from './LoginPage';

describe('LoginPage', () => {
  it('renders the Enlinka Chat sign-in heading and sets the page title', () => {
    render(<LoginPage />);
    expect(screen.getByRole('heading', { name: /sign in — enlinka chat/i })).toBeInTheDocument();
    expect(document.title).toBe('Sign in · Enlinka Chat');
  });
});
