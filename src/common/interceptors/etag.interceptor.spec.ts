import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { EtagInterceptor } from './etag.interceptor';
import type { Request, Response } from 'express';

describe('EtagInterceptor', () => {
  let interceptor: EtagInterceptor;

  beforeEach(() => {
    interceptor = new EtagInterceptor();
  });

  it('should set ETag header on GET responses', (done) => {
    const headersSet: Record<string, string> = {};
    const mockReq = { method: 'GET', headers: {} } as unknown as Request;
    const mockRes = {
      setHeader: jest.fn((k, v) => {
        headersSet[k] = v;
      }),
      status: jest.fn(),
    } as unknown as Response;

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockReq,
        getResponse: () => mockRes,
      }),
    } as unknown as ExecutionContext;

    const data = { hello: 'world' };
    const mockNext: CallHandler = {
      handle: () => of(data),
    };

    interceptor.intercept(mockContext, mockNext).subscribe({
      next: (val) => {
        expect(mockRes.setHeader).toHaveBeenCalledWith(
          'ETag',
          expect.stringMatching(/^W\/"[a-f0-9]{64}"$/),
        );
        expect(val).toEqual(data);
        done();
      },
    });
  });

  it('should return 304 and null body when If-None-Match matches ETag', (done) => {
    let computedEtag = '';
    const mockReq = {
      method: 'GET',
      headers: {},
    } as unknown as Request;

    const mockRes = {
      setHeader: jest.fn((k, v) => {
        if (k === 'ETag') computedEtag = v;
      }),
      status: jest.fn(),
    } as unknown as Response;

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockReq,
        getResponse: () => mockRes,
      }),
    } as unknown as ExecutionContext;

    const data = { summary: 'test-304' };
    const mockNext: CallHandler = {
      handle: () => of(data),
    };

    // First call to get etag
    interceptor.intercept(mockContext, mockNext).subscribe({
      next: () => {
        // Second call with If-None-Match
        (mockReq.headers as Record<string, string>)['if-none-match'] = computedEtag;
        interceptor.intercept(mockContext, mockNext).subscribe({
          next: (val) => {
            expect(mockRes.status).toHaveBeenCalledWith(304);
            expect(val).toBeNull();
            done();
          },
        });
      },
    });
  });

  it('should ignore non-GET methods', (done) => {
    const mockReq = { method: 'POST', headers: {} } as unknown as Request;
    const mockRes = {
      setHeader: jest.fn(),
      status: jest.fn(),
    } as unknown as Response;

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockReq,
        getResponse: () => mockRes,
      }),
    } as unknown as ExecutionContext;

    const data = { created: true };
    const mockNext: CallHandler = {
      handle: () => of(data),
    };

    interceptor.intercept(mockContext, mockNext).subscribe({
      next: (val) => {
        expect(mockRes.setHeader).not.toHaveBeenCalled();
        expect(val).toEqual(data);
        done();
      },
    });
  });
});

