import { IsString, IsOptional } from 'class-validator';
import { EmptyToUndefined } from '../../../common/utils/dto-transforms.util';

export class CancelConnectDto {
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  reason?: string;
}
