import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  ArrayNotEmpty,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BulkUpdateClipsDto {
  @ApiProperty({
    description: 'IDs of clips to update — must all belong to the requesting user',
    example: ['clip-1', 'clip-2', 'clip-3'],
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  clipIds: string[];

  @ApiPropertyOptional({
    description: 'Mark clips as curated/selected',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  selected?: boolean;

  @ApiPropertyOptional({
    description: 'Posting status. Simple values: pending | posted | failed, or platform-specific JSON object',
    example: { platform: 'tiktok', status: 'posted', postId: '12345' },
  })
  @IsOptional()
  postStatus?: unknown;

  @ApiPropertyOptional({
    description: 'User-editable caption to override the auto-generated one',
    example: 'Check out this amazing clip! 🎬',
  })
  @IsOptional()
  @IsString()
  caption?: string;

  @ApiPropertyOptional({
    description: 'NFT royalty percentage in Basis Points (BPS). 1000 BPS = 10%, range: 0-1500 (0-15%)',
    example: 1000,
    minimum: 0,
    maximum: 1500,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  royaltyBps?: number;
}
