import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Back-Telerady server is running"', () => {
      expect(appController.getHello()).toBe('Back-Telerady server is running');
    });
  });

  describe('healthz', () => {
    it('responds 200 with { status: "ok" } so the Docker HEALTHCHECK / K8s liveness probe pass', () => {
      expect(appController.healthz()).toEqual({ status: 'ok' });
    });
  });
});
