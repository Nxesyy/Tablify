import { Test, TestingModule } from '@nestjs/testing';
import { DiskonController } from './diskon.controller.js';
import { DiskonService } from './diskon.service.js';

describe('DiskonController', () => {
  let controller: DiskonController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DiskonController],
      providers: [DiskonService],
    }).compile();

    controller = module.get<DiskonController>(DiskonController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
