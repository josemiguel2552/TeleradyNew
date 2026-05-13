import { Test, TestingModule } from '@nestjs/testing';

jest.mock('../../../../database/drizzle', () => ({ db: {} }));

import { GetSubspecialtiesHandler } from '../get-subspecialties.handler';
import { ParametersRepository } from '../../repositories/parameters.repository';
import { I18nService } from '../../../../i18n/i18n.service';
import { GetSubspecialtiesQuery } from '../../queries/get-subspecialties.query';
import { InternalServerErrorException } from '@nestjs/common';

describe('GetSubspecialtiesHandler', () => {
  let handler: GetSubspecialtiesHandler;
  let parametersRepositoryMock: Partial<ParametersRepository>;
  let i18nServiceMock: Partial<I18nService>;

  beforeEach(async () => {
    parametersRepositoryMock = {
      getSubspecialties: jest.fn(),
    };

    i18nServiceMock = {
      translate: jest.fn((key: string) => key), 
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetSubspecialtiesHandler,
        { provide: ParametersRepository, useValue: parametersRepositoryMock },
        { provide: I18nService, useValue: i18nServiceMock },
      ],
    }).compile();

    handler = module.get<GetSubspecialtiesHandler>(GetSubspecialtiesHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should return subspecialties with a success response', async () => {
    const mockSubspecialties = [
      { id: 1, name: 'Cardiology' },
      { id: 2, name: 'Neurology' },
    ];
    (parametersRepositoryMock.getSubspecialties as jest.Mock).mockResolvedValue(mockSubspecialties);

    const query = new GetSubspecialtiesQuery();
    const result = await handler.execute(query);

    expect(parametersRepositoryMock.getSubspecialties).toHaveBeenCalled();
    expect(i18nServiceMock.translate).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: true,
      message: '',
      response: mockSubspecialties,
    });
  });

  it('should return a no data message when subspecialties are empty', async () => {
    (parametersRepositoryMock.getSubspecialties as jest.Mock).mockResolvedValue([]);

    const query = new GetSubspecialtiesQuery();
    const result = await handler.execute(query);

    expect(parametersRepositoryMock.getSubspecialties).toHaveBeenCalled();
    expect(i18nServiceMock.translate).toHaveBeenCalledWith('parameters.subspecialties.noData');
    expect(result).toEqual({
      ok: true,
      message: 'parameters.subspecialties.noData',
      response: [],
    });
  });

  it('should throw an InternalServerErrorException on error', async () => {
    (parametersRepositoryMock.getSubspecialties as jest.Mock).mockRejectedValue(new Error('Database error'));

    const query = new GetSubspecialtiesQuery();

    await expect(handler.execute(query)).rejects.toThrow(InternalServerErrorException);
    expect(i18nServiceMock.translate).toHaveBeenCalledWith('parameters.subspecialties.errorMessage');
  });
});