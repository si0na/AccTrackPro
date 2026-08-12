import { describe, beforeAll, afterAll, beforeEach, it, expect, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { GraphMailService } from '../graph-mail.service';


describe('GraphMailService', () => {
  let service: GraphMailService;
  let originalFetch: typeof global.fetch;

  beforeAll(() => {
    originalFetch = global.fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GraphMailService],
    }).compile();

    service = module.get<GraphMailService>(GraphMailService);

    // Reset env vars before each test
    process.env.AZURE_TENANT_ID = 'test-tenant';
    process.env.AZURE_CLIENT_ID = 'test-client';
    process.env.AZURE_CLIENT_SECRET = 'test-secret';
    process.env.GRAPH_SENDER_EMAIL = 'noreply@reflectionsinfos.com';
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return false if credentials are missing', async () => {
    delete process.env.AZURE_TENANT_ID;
    const result = await service.sendMail('user@example.com', 'Subject', '<p>Test</p>');
    expect(result).toBe(false);
  });

  it('should successfully get token and send email', async () => {
    const mockFetch = jest.fn() as any;
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'mock-access-token' }),
      })
      .mockResolvedValueOnce({
        ok: true,
      });

    global.fetch = mockFetch;

    const result = await service.sendMail('user@example.com', 'Subject', '<p>Test</p>');

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Verify token request
    expect(mockFetch.mock.calls[0][0]).toContain('https://login.microsoftonline.com/test-tenant/oauth2/v2.0/token');
    const tokenRequestBody = (mockFetch.mock.calls as any)[0][1].body;
    expect(tokenRequestBody).toContain('client_id=test-client');
    expect(tokenRequestBody).toContain('client_secret=test-secret');
    expect(tokenRequestBody).toContain('grant_type=client_credentials');

    // Verify sendMail request
    expect(mockFetch.mock.calls[1][0]).toContain('https://graph.microsoft.com/v1.0/users/noreply%40reflectionsinfos.com/sendMail');
    expect((mockFetch.mock.calls as any)[1][1].headers.Authorization).toBe('Bearer mock-access-token');
  });

  it('should handle token fetch failure gracefully', async () => {
    const mockFetch = jest.fn() as any;
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
    });

    global.fetch = mockFetch;

    const result = await service.sendMail('user@example.com', 'Subject', '<p>Test</p>');

    expect(result).toBe(false);
  });

  it('should handle sendMail API failure gracefully', async () => {
    const mockFetch = jest.fn() as any;
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'mock-access-token' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

    global.fetch = mockFetch;

    const result = await service.sendMail('user@example.com', 'Subject', '<p>Test</p>');

    expect(result).toBe(false);
  });
});
