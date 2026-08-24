import { Module } from '@nestjs/common';
import { SqaController } from './sqa.controller';
import { SqaService } from './sqa.service';
import { ProjectsModule } from '../projects/projects.module';

/**
 * SQA module. Imports ProjectsModule rather than re-querying projects: the SQA
 * record's Account / PM / Revenue / Tower all come from the Project, and its
 * weekly health is read from and written to the project health trail through
 * ProjectHealthService — SQA adds no parallel copy of either.
 */
@Module({
  imports: [ProjectsModule],
  controllers: [SqaController],
  providers: [SqaService],
  exports: [SqaService],
})
export class SqaModule {}
