import { Body, Controller, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthenticatedRequest, JwtAuthGuard } from "../auth.guard";
import { BuildDraftDto, UpdateBuildDto } from "./build.dto";
import { BuildsService } from "./builds.service";

@ApiTags("builds")
@Controller("builds")
export class BuildsController {
  constructor(private readonly builds: BuildsService) {}

  @Post("preview")
  async preview(@Body() draft: BuildDraftDto) {
    const { analysis } = await this.builds.preview(draft);
    return analysis;
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  save(@Body() draft: BuildDraftDto, @Req() request: AuthenticatedRequest) {
    return this.builds.save(draft, request.user.sub);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() draft: UpdateBuildDto, @Req() request: AuthenticatedRequest) {
    return this.builds.update(id, draft, request.user.sub);
  }
}
