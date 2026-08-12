import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { OpportunitiesService } from '../opportunities.service';

describe('OpportunitiesService - Project Manager Validation', () => {
  let service: OpportunitiesService;
  let mockDb: any;
  let mockFilter: any;
  let mockAccess: any;
  let mockPermissions: any;
  let mockBus: any;
  let mockProjectsService: any;

  beforeEach(() => {
    mockDb = {
      query: jest.fn(),
    };
    mockFilter = {};
    mockAccess = {};
    mockPermissions = {
      userHasRole: jest.fn(),
    };
    mockBus = {
      emit: jest.fn(),
    };
    mockProjectsService = {};

    service = new OpportunitiesService(
      mockDb,
      mockFilter,
      mockAccess,
      mockPermissions,
      mockBus,
      mockProjectsService,
    );
  });

  describe('validatePm', () => {
    it('should pass validation if serviceProviderPmId is undefined or null', async () => {
      // No role check should happen
      await expect((service as any).validatePm(undefined)).resolves.not.toThrow();
      await expect((service as any).validatePm(null)).resolves.not.toThrow();
      expect(mockPermissions.userHasRole).not.toHaveBeenCalled();
    });

    it('should pass validation if the user holds the project-manager role', async () => {
      mockPermissions.userHasRole.mockResolvedValue(true);

      await expect((service as any).validatePm('pm-user-id')).resolves.not.toThrow();
      expect(mockPermissions.userHasRole).toHaveBeenCalledWith('pm-user-id', 'project-manager');
    });

    it('should throw BadRequestException if the user does not hold the project-manager role', async () => {
      mockPermissions.userHasRole.mockResolvedValue(false);

      await expect((service as any).validatePm('non-pm-user-id')).rejects.toThrow(
        new BadRequestException('The selected Service Provider Project Manager does not have the Project Manager role.'),
      );
      expect(mockPermissions.userHasRole).toHaveBeenCalledWith('non-pm-user-id', 'project-manager');
    });
  });
});
