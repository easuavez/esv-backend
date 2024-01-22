import { Injectable } from '@nestjs/common';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { BuilderInterface } from '../../shared/interfaces/builder';
import { AttentionStatus } from '../model/attention-status.enum';
import { AttentionType } from '../model/attention-type.enum';
import { Attention } from '../model/attention.entity';
import { QueueService } from '../../queue/queue.service';
import { Queue } from '../../queue/queue.entity';
import AttentionCreated from '../events/AttentionCreated';
import { publish } from 'ett-events-lib';

@Injectable()
export class AttentionSurveyBuilder implements BuilderInterface {
  constructor(
    @InjectRepository(Attention)
    private attentionRepository = getRepository(Attention),
    private queueService: QueueService,
  ){}

  async create(queue: Queue, collaboratorId?: string, channel?: string, userId?: string): Promise<Attention> {
    const currentNumber = queue.currentNumber;
    let attention = new Attention();
    attention.status = AttentionStatus.PROCESSING;
    attention.type = AttentionType.SURVEY_ONLY;
    attention.createdAt = new Date();
    attention.queueId = queue.id;
    attention.commerceId = queue.commerceId;
    attention.number = currentNumber + 1;
    attention.endAt = new Date();
    attention.channel = channel;
    if (collaboratorId !== undefined) {
      attention.collaboratorId = collaboratorId;
    }
    if (userId !== undefined) {
      attention.userId = userId;
    }
    let attentionCreated = await this.attentionRepository.create(attention);
    queue.currentNumber = attention.number;
    if (queue.currentNumber === 1) {
      queue.currentAttentionId = attentionCreated.id;
      queue.currentAttentionNumber = attention.number;
    }
    queue.currentAttentionNumber = queue.currentAttentionNumber + 1;
    await this.queueService.updateQueue('', queue);

    const attentionCreatedEvent = new AttentionCreated(new Date(), attentionCreated);
    publish(attentionCreatedEvent);
    return attentionCreated;
  }
}