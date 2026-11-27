edJob.id }, { queueEnqueuedAt: new Date() });
      } catch (ackError) {
        this.logger.warn(`AI job ${persistedJob.id} queued but enqueue acknowledgement failed: ${ackError instanceof Error ? ackError.message : String(ackError)}`);
      }
    } catch {
      await this.jobs.update({ id: persistedJob.id }, {
        status: 'failed',
        error: 'AI navbatiga qo‘shib bo‘lmadi. Qayta urinib ko‘ring.',
        completedAt: new Date(),
        fileBuffer: null,
      });
      if (usage && input.quotaFeature) {
        try {
          if (input.userId) await this.featureUsage.refund(input.userId, input.quotaFeature as never);
          await this.jobs.update({ id: persistedJob.id }, { quotaRefunded: true });
        } catch { /* Preserve the queue error; refund can be retried operationally. */ }
      }
      throw new ServiceUnavailableException('AI navbatiga ulanishda xatolik. Qayta urinib ko‘ring.');
    }

    return { status: 'queued', jobId: persistedJob.id, message: 'Test tayyorlanmoqda', usage };
  }

  async reconcilePendingJobs(): Promise<void> {
    if (!this.queue) return;
    const batchSize = boundedInteger(process.env.AI_QUEUE_RECONCILE_BATCH_SIZE, 500, 1, 5000);
    const pending = await this.jobs.find({
      where: { status: In(['queued', 'active']), queueEnqueuedAt: IsNull() },
      order: { createdAt: 'ASC' },
      take: batchSize,
    });
    let requeued = 0;
    let completed = 0;
    let failed = 0;

    for (const job of pending) {
      try {
        const bullJob = await this.queue.getJob(job.id);
        if (!bullJob) {
          await this.queue.add(job.jobType, { jobId: job.id }, {
            jobId: job.id,
            priority: job.priority ?? (job.userId ? 20 : 100),
          });
          await this.jobs.update({ id: job.id }, { queueEnqueuedAt: new Date() });
          requeued += 1;
          continue;
        }

        const state = await bullJob.getState();
        await this.jobs.update({ id: job.id }, { queueEnqueuedAt: new Date() });
        if (state === 'completed' && job.status !== 'completed') {
          const value = bullJob.returnvalue;
          const result = value && typeof value === 'object'
            ? value as Record<string, unknown>
            : { value };
          await this.markCompleted(job.id, result);
          completed += 1;
        } else if (state === 'failed' && bullJob.attemptsMade >= Number(bullJob.opts.attempts || 1)) {
          await this.markFailedAndRefund(job.id, new Error(bullJob.failedReason || 'AI worker failed'));
          failed += 1;
        }
      } catch (error) {
        this.logger.warn(`AI job recovery skipped for ${job.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    this.logger.log(`AI job recovery: ${requeued} requeued, ${completed} reconciled, ${failed} failed`);
  }

  async getOwnedJob(userId: string, jobId: string): Promise<AiGenerationJob> {
    const job = await this.jobs.findOne({ where: { id: jobId, userId } });
    if (!job) {
      // Avoid revealing whether a job belongs to another account.
      throw new NotFoundException('AI so‘rovi topilmadi.');
    }
    return job;
  }

  async getJobForWorker(jobId: string): Promise<AiGenerationJob> {
    const job = await this.jobs.createQueryBuilder('job')
      .addSelect('job.fileBuffer')
      .where('job.id = :jobId', { jobId })
      .getOne();
    if (!job) throw new Error('AI generation job not found');
    return job;
  }

  async assertJobActive(jobId: string): Promise<void> {
    const job = await this.jobs.findOne({ where: { id: jobId } });
    if (!job || job.status === 'failed') {
      throw new HttpException('Test yaratish bekor qilindi.', HttpStatus.GONE);
    }
  }

  async getStatus(userId: string, jobId: string) {
    const job = await this.getOwnedJob(userId, jobId);
    const bullJob = this.queue ? await this.queue.getJob(job.id) : null;
    return {
      jobId: job.id,
      status: job.status,
      progress: bullJob?.progress ?? { step: job.status === 'queued' ? 'uploading' : job.status },
      result: job.status === 'completed' ? job.result : undefined,
      error: job.status === 'failed' ? job.error : undefined,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    };
  }

  async cancelJob(userId: string, jobId: string): Promise<{ cancelled: boolean; message: string }> {
    const job = await this.getOwnedJob(userId, jobId);
    if (job.status === 'completed') return { cancelled: false, message: 'Test allaqachon tayyor.' };
    if (job.status === 'failed') return { cancelled: true, message: 'Vazifa allaqachon to‘xtatilgan.' };
    const bullJob = this.queue ? await this.queue.getJob(job.id) : null;
    if (bullJob) {
      const state = await bullJob.getState();
      if (['waiting', 'delayed', 'waiting-children', 'paused'].includes(state)) {
        try { await bullJob.remove(); } catch { /* Worker may have claimed it concurrently. */ }
      }
    }
    await this.markFailedAndRefund(job.id, new Error('Foydalanuvchi test yaratishni bekor qildi.'));
    return { cancelled: true, message: 'Test yaratish bekor qilindi.' };
  }

  async markActive(jobId: string): Promise<AiGenerationJob> {
    const existing = await this.jobs.findOne({ where: { id: jobId } });
    if (!existing) throw new Error('AI generation job not found');
    if (existing.status === 'completed' || existing.status === 'failed') return existing;
    await this.jobs.increment({ id: jobId }, 'attempts', 1);
    await this.jobs.update({ id: jobId, status: 'queued' }, { status: 'active', error: null });
    const job = await this.jobs.findOne({ where: { id: jobId } });
    if (!job) throw new Error('AI generation job not found');
    return job;
  }

  async markCompleted(jobId: string, result: Record<string, unknown>): Promise<void> {
    const job = await this.jobs.findOne({ where: { id: jobId } });
    if (!job) throw new Error('AI generation job not found');
    if (job.status === 'failed') return;
    job.status = 'completed';
    job.result = result;
    job.fileBuffer = null;
    job.error = null;
    job.completedAt = new Date();
    job.queueEnqueuedAt = job.queueEnqueuedAt ?? new Date();
    await this.jobs.save(job);
  }

  async markRetrying(jobId: string, error: unknown): Promise<void> {
    await this.jobs.update({ id: jobId, status: 'active' }, {
      status: 'queued',
      error: error instanceof Error ? error.message.slice(0, 500) : 'AI generation failed',
    });
  }

  async markFailedAndRefund(jobId: string, error: unknown): Promise<void> {
    const job = await this.jobs.findOne({ where: { id: jobId } });
    if (!job || job.status === 'completed') return;
    if (job.status !== 'failed') {
      await this.jobs.update({ id: jobId }, {
        status: 'failed',
        error: error instanceof Error ? error.message.slice(0, 1000) : 'AI generation failed',
        fileBuffer: null,
        completedAt: new Date(),
      });
    }
    if (job.quotaConsumed && job.quotaFeature && !job.quotaRefunded) {
      try {
        if (!job.userId) throw new Error('Quota job owner is missing');
        await this.featureUsage.refund(job.userId, job.quotaFeature as never);
        await this.jobs.update({ id: jobId }, { quotaRefunded: true });
      } catch (refundError) {
        this.logger.error(`AI job quota refund failed for ${jobId}: ${refundError instanceof Error ? refundError.message : String(refundError)}`);
      }
    }
  }
}
