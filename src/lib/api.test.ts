import { describe, expect, it } from 'vitest';
import { AxiosError } from 'axios';
import api, { getApiErrorMessage } from './api';

describe('API request headers', () => {
  it('does not force JSON content type so FormData receives a multipart boundary', () => {
    expect(api.defaults.headers.common['Content-Type']).toBeUndefined();
  });
});

describe('API validation errors', () => {
  it('surfaces field messages instead of the generic Problem Details title', () => {
    const error = new AxiosError('Bad Request', 'ERR_BAD_REQUEST', undefined, undefined, {
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      config: { headers: {} } as never,
      data: {
        title: 'One or more validation errors occurred.',
        errors: { files: ['The files field is required.'], request: ['The request field is required.'] }
      }
    });
    expect(getApiErrorMessage(error)).toBe('The files field is required. The request field is required.');
  });

  it('deduplicates repeated validation messages', () => {
    const error = new AxiosError('Bad Request', 'ERR_BAD_REQUEST', undefined, undefined, {
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      config: { headers: {} } as never,
      data: { errors: { first: ['Invalid value.'], second: ['Invalid value.'] } }
    });
    expect(getApiErrorMessage(error)).toBe('Invalid value.');
  });
});
