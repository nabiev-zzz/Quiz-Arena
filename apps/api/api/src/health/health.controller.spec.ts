import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  const queryMock = jest.fn();
  const dataSource = {
    isInitialized: true,
    query: queryMock,
  } as unknown as DataSource;
  let controller: HealthController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new HealthController(dataSource);
  });

  it('reports liveness without checking dependencies', () => {
    expect(controller.getLiveness()).toEqual({ status: 'ok' });
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('reports readiness when PostgreSQL responds', async () => {
    queryMock.mockResolvedValue([{ '?column?': 1 }]);

    await expect(controller.getReadiness()).resolves.toEqual({
      status: 'ok',
      checks: { database: 'ok' },
    });
  });

  it('returns service unavailable when PostgreSQL is unavailable', async () => {
    queryMock.mockRejectedValue(new Error('connection failed'));

    await expect(controller.getReadiness()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('returns service unavailable before the database initializes', async () => {
    Object.defineProperty(dataSource, 'isInitialized', { value: false });

    await expect(controller.getReadiness()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
