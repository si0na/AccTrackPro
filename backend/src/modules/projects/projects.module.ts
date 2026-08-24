import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectTeamController } from './project-team.controller';
import { ProjectTeamService } from './project-team.service';
import { ProjectMilestonesController } from './project-milestones.controller';
import { ProjectMilestonesService } from './project-milestones.service';
import { ProjectRisksController } from './project-risks.controller';
import { ProjectRisksService } from './project-risks.service';
import { ProjectAssumptionsController } from './project-assumptions.controller';
import { ProjectAssumptionsService } from './project-assumptions.service';
import { ProjectIssuesController } from './project-issues.controller';
import { ProjectIssuesService } from './project-issues.service';
import { ProjectDependenciesController } from './project-dependencies.controller';
import { ProjectDependenciesService } from './project-dependencies.service';
import { ProjectHealthController } from './project-health.controller';
import { ProjectHealthService } from './project-health.service';

@Module({
  controllers: [
    ProjectsController,
    ProjectTeamController,
    ProjectMilestonesController,
    ProjectRisksController,
    ProjectAssumptionsController,
    ProjectIssuesController,
    ProjectDependenciesController,
    ProjectHealthController,
  ],
  providers: [
    ProjectsService,
    ProjectTeamService,
    ProjectMilestonesService,
    ProjectRisksService,
    ProjectAssumptionsService,
    ProjectIssuesService,
    ProjectDependenciesService,
    ProjectHealthService,
  ],
  // ProjectHealthService is exported for the SQA module's weekly health grid,
  // which reads and writes the same project_health_updates trail.
  exports: [ProjectsService, ProjectHealthService],
})
export class ProjectsModule {}
