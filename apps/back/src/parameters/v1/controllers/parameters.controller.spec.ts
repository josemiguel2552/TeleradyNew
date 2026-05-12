import { Test, TestingModule } from '@nestjs/testing';
import { ParametersController } from './parameters.controller';
import { QueryBus } from '@nestjs/cqrs';
import { Request } from 'express';
import { I18nService } from '../../../i18n/i18n.service';
import { GetParameterResponse } from '../models/get-parameters.entity';
import { GetSubspecialtiesQuery } from '../queries/get-subspecialties.query';

describe('ParametersController', () => {
  let controller: ParametersController;
  let queryBusMock: Partial<QueryBus>;
  let i18nServiceMock: Partial<I18nService>;

  beforeEach(async () => {
    queryBusMock = {
      execute: jest.fn(),
    };

    i18nServiceMock = {
      setLang: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ParametersController],
      providers: [
        { provide: QueryBus, useValue: queryBusMock },
        { provide: I18nService, useValue: i18nServiceMock },
      ],
    }).compile();

    controller = module.get<ParametersController>(ParametersController);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('get Subspecialties', () => {
    it('should return subspecialties successfully', async () => {
      const mockRequest = { headers: { 'accept-language': 'en' } } as Request;
      const mockResponse: GetParameterResponse = {
        ok: true,
        message: '',
        response: [
          { id: 1, name: 'Cardiology' },
          { id: 2, name: 'Neurology' },
        ],
      };

      (queryBusMock.execute as jest.Mock).mockResolvedValue(mockResponse);

      const result = await controller.getSubspecialties(mockRequest);

      expect(i18nServiceMock.setLang).toHaveBeenCalledWith(mockRequest);
      expect(queryBusMock.execute).toHaveBeenCalledWith(new GetSubspecialtiesQuery());
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors thrown by QueryBus', async () => {
      const mockRequest = { headers: { 'accept-language': 'en' } } as Request;

      (queryBusMock.execute as jest.Mock).mockRejectedValue(new Error('QueryBus error'));

      await expect(controller.getSubspecialties(mockRequest)).rejects.toThrow('QueryBus error');

      expect(i18nServiceMock.setLang).toHaveBeenCalledWith(mockRequest);
      expect(queryBusMock.execute).toHaveBeenCalledWith(new GetSubspecialtiesQuery());
    });
  });
});
