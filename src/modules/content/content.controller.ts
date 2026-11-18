import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ContentService } from './content.service';

@Controller()
export class ContentController {
  constructor(private readonly content: ContentService) {}

  // articles (admin)
  @MessagePattern('news.adminList') adminList(@Payload() q: any) { return this.content.articleAdminList(q); }
  @MessagePattern('news.adminGet') adminGet(@Payload() id: string) { return this.content.articleAdminGet(id); }
  @MessagePattern('news.create') create(@Payload() p: { dto: any; author?: any }) { return this.content.articleCreate(p.dto, p.author); }
  @MessagePattern('news.update') update(@Payload() p: { id: string; dto: any }) { return this.content.articleUpdate(p.id, p.dto); }
  @MessagePattern('news.remove') remove(@Payload() id: string) { return this.content.articleRemove(id); }
  // articles (public)
  @MessagePattern('news.publicList') publicList(@Payload() q: any) { return this.content.articlePublicList(q); }
  @MessagePattern('news.publicGet') publicGet(@Payload() p: { idOrSlug: string; countView?: boolean }) { return this.content.articlePublicGet(p.idOrSlug, p.countView !== false); }

  // shorts (admin)
  @MessagePattern('shorts.adminList') sAdminList(@Payload() q: any) { return this.content.shortAdminList(q); }
  @MessagePattern('shorts.create') sCreate(@Payload() p: { dto: any; author?: any }) { return this.content.shortCreate(p.dto, p.author); }
  @MessagePattern('shorts.update') sUpdate(@Payload() p: { id: string; dto: any }) { return this.content.shortUpdate(p.id, p.dto); }
  @MessagePattern('shorts.remove') sRemove(@Payload() id: string) { return this.content.shortRemove(id); }
  // shorts (public)
  @MessagePattern('shorts.publicList') sPublicList(@Payload() q: any) { return this.content.shortPublicList(q); }
  @MessagePattern('shorts.view') sView(@Payload() id: string) { return this.content.shortView(id); }
  @MessagePattern('shorts.like') sLike(@Payload() p: { id: string; like: boolean }) { return this.content.shortLike(p.id, p.like); }
}
